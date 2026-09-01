import { Router } from 'express';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { bookQuerySchema, bookSchema, cleanInt, cleanNull, normalizeIsbn, parse } from '../validation';
import { resolveBookMetadata } from '../lib/cover';
import { coverLimiter } from '../middleware/cover-rate-limit';
import {
  listDocs,
  getDoc,
  createDoc,
  updateDoc,
  COLLECTIONS,
  type Doc,
} from '../lib/store';

export const bookRouter = Router();

const ACTIVE_LOAN_STATUSES = ['ACTIVE', 'OVERDUE'];

async function resolveAuthorNames(
  names: string[],
): Promise<{ ids: string[]; created: { id: string; name: string }[] }> {
  const ids: string[] = [];
  const created: { id: string; name: string }[] = [];
  if (names.length === 0) return { ids, created };
  const { docs } = await listDocs(COLLECTIONS.authors, { pageSize: 1000 });
  const nameMap = new Map(docs.map((a) => [a.name.toLowerCase(), a.$id]));
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existingId = nameMap.get(key);
    if (existingId) {
      ids.push(existingId);
    } else {
      const author = await createDoc(COLLECTIONS.authors, { name, isActive: true });
      created.push({ id: author.$id, name: author.name });
      nameMap.set(key, author.$id);
      ids.push(author.$id);
    }
  }
  return { ids, created };
}

async function resolveSubjectNames(
  names: string[],
): Promise<{ ids: string[]; created: { id: string; name: string }[] }> {
  const ids: string[] = [];
  const created: { id: string; name: string }[] = [];
  if (names.length === 0) return { ids, created };
  const { docs } = await listDocs(COLLECTIONS.subjects, { pageSize: 1000 });
  const nameMap = new Map(docs.map((c) => [c.name.toLowerCase(), c.$id]));
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existingId = nameMap.get(key);
    if (existingId) {
      ids.push(existingId);
    } else {
      const subject = await createDoc(COLLECTIONS.subjects, { name, status: 'ACTIVE' });
      created.push({ id: subject.$id, name: subject.name });
      nameMap.set(key, subject.$id);
      ids.push(subject.$id);
    }
  }
  return { ids, created };
}

async function resolveKnowledgeAreaNames(
  names: string[],
): Promise<{ ids: string[]; created: { id: string; name: string }[] }> {
  const ids: string[] = [];
  const created: { id: string; name: string }[] = [];
  if (names.length === 0) return { ids, created };
  const { docs } = await listDocs(COLLECTIONS.knowledgeAreas, { pageSize: 1000 });
  const nameMap = new Map(docs.map((k) => [k.name.toLowerCase(), k.$id]));
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existingId = nameMap.get(key);
    if (existingId) {
      ids.push(existingId);
    } else {
      const ka = await createDoc(COLLECTIONS.knowledgeAreas, { name });
      created.push({ id: ka.$id, name: ka.name });
      nameMap.set(key, ka.$id);
      ids.push(ka.$id);
    }
  }
  return { ids, created };
}

async function resolveNames(
  collection: 'authors' | 'subjects' | 'knowledgeAreas',
  ids: string[],
): Promise<Map<string, string>> {
  const { docs } = await listDocs(COLLECTIONS[collection], { pageSize: 1000 });
  const map = new Map(docs.map((d) => [d.$id, d.name]));
  return map;
}

function mapBook(b: Doc, isAvailable: boolean) {
  return { ...b, isAvailable };
}

async function loanedBookIds(): Promise<Set<string>> {
  const { docs } = await listDocs(COLLECTIONS.loans, { pageSize: 1000 });
  const ids = new Set<string>();
  for (const loan of docs) {
    if (ACTIVE_LOAN_STATUSES.includes(loan.status)) {
      ids.add(String(loan.bookId));
    }
  }
  return ids;
}

function providedIsbns(data: { isbn10?: string | null; isbn13?: string | null }): string[] {
  const set: string[] = [];
  for (const value of [data.isbn10, data.isbn13]) {
    if (!value) continue;
    const normalized = normalizeIsbn(value);
    if (normalized && !set.includes(normalized)) set.push(normalized);
  }
  return set;
}

async function findDuplicateBook(isbns: string[], excludeId?: string) {
  if (isbns.length === 0) return null;
  const { docs } = await listDocs(COLLECTIONS.books, { pageSize: 1000 });
  return (
    docs.find((b) => {
      if (excludeId && b.$id === excludeId) return false;
      return isbns.some((isbn) => b.isbn10 === isbn || b.isbn13 === isbn);
    }) ?? null
  );
}

function duplicateConflict(res: any, duplicate: Doc) {
  res.status(409).json({
    success: false,
    code: 'BOOK_ALREADY_EXISTS',
    message: 'Este livro já está cadastrado.',
    duplicate: {
      id: duplicate.$id,
      titulo: duplicate.title,
      isbn10: duplicate.isbn10,
      isbn13: duplicate.isbn13,
    },
  });
}

function matchesSearch(book: Doc, search: string): boolean {
  const s = search.toLowerCase();
  if (book.title?.toLowerCase().includes(s)) return true;
  if (book.subtitle?.toLowerCase().includes(s)) return true;
  if (book.isbn10?.toLowerCase().includes(s)) return true;
  if (book.isbn13?.toLowerCase().includes(s)) return true;
  if (book.publisher?.toLowerCase().includes(s)) return true;
  if (Array.isArray(book.authorNames)) {
    for (const name of book.authorNames) {
      if (name.toLowerCase().includes(s)) return true;
    }
  }
  return false;
}

async function buildNamesMap(
  collection: 'authors' | 'subjects' | 'knowledgeAreas',
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  const map = await resolveNames(collection, ids);
  return ids.map((id) => map.get(id) ?? '');
}

bookRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(bookQuerySchema, req.query);
    const search = q.search;

    let loanedIds: Set<string> = new Set();
    if (q.availability) {
      loanedIds = await loanedBookIds();
    }

    const { docs: allBooks } = await listDocs(COLLECTIONS.books, { pageSize: 1000 });

    let filtered = allBooks.filter((b) => {
      if (!q.includeArchived && b.isArchived !== false) return false;
      if (q.subjectId) {
        const catIdStr = String(q.subjectId);
        if (!Array.isArray(b.subjectIds) || !b.subjectIds.includes(catIdStr)) return false;
      }
      if (q.format && b.format !== q.format) return false;
      if (search && !matchesSearch(b, search)) return false;
      if (q.availability) {
        const bid = String(b.$id);
        if (q.availability === 'available' && loanedIds.has(bid)) return false;
        if (q.availability === 'unavailable' && !loanedIds.has(bid)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (q.sort === 'title') return (a.title || '').localeCompare(b.title || '');
      if (q.sort === 'oldest') return (a.$createdAt || '').localeCompare(b.$createdAt || '');
      return (b.$createdAt || '').localeCompare(a.$createdAt || '');
    });

    const total = filtered.length;
    const start = (q.page - 1) * q.pageSize;
    const items = filtered.slice(start, start + q.pageSize);

    if (loanedIds.size === 0) loanedIds = await loanedBookIds();

    res.json({
      items: items.map((b) => mapBook(b, !loanedIds.has(String(b.$id)))),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    });
  }),
);

bookRouter.get(
  '/cover',
  coverLimiter,
  asyncHandler(async (req, res) => {
    const isbn = typeof req.query.isbn === 'string' ? req.query.isbn.trim() : '';
    if (!isbn) throw new HttpError(400, 'Informe um ISBN');
    const info = await resolveBookMetadata(isbn);
    if (!info) throw new HttpError(404, 'Capa não encontrada');
    res.json(info);
  }),
);

bookRouter.get(
  '/exists',
  requireAuth,
  asyncHandler(async (req, res) => {
    const raw = typeof req.query.isbn === 'string' ? req.query.isbn.trim() : '';
    const isbn = raw ? normalizeIsbn(raw) : '';
    if (!isbn) throw new HttpError(400, 'Informe um ISBN');
    const exclude = typeof req.query.exclude === 'string' ? req.query.exclude : undefined;
    const { docs } = await listDocs(COLLECTIONS.books, { pageSize: 1000 });
    const book =
      docs.find((b) => {
        if (exclude && b.$id === exclude) return false;
        return b.isbn10 === isbn || b.isbn13 === isbn;
      }) ?? null;
    res.json({ book });
  }),
);

bookRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const book = await getDoc(COLLECTIONS.books, id);
    if (!book) throw new HttpError(404, 'Livro não encontrado');

    const { docs: allLoans } = await listDocs(COLLECTIONS.loans, { pageSize: 1000 });
    const bookLoans = allLoans
      .filter((l) => String(l.bookId) === id)
      .sort((a: Doc, b: Doc) => (b.$createdAt || '').localeCompare(a.$createdAt || ''))
      .slice(0, 10);
    const activeLoanCount = allLoans.filter(
      (l) => String(l.bookId) === id && ACTIVE_LOAN_STATUSES.includes(l.status),
    ).length;

    res.json({
      ...mapBook(book, activeLoanCount === 0),
      loans: bookLoans,
      hasActiveLoan: activeLoanCount > 0,
    });
  }),
);

bookRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = parse(bookSchema, req.body);
    const duplicate = await findDuplicateBook(providedIsbns(data));
    if (duplicate) {
      duplicateConflict(res, duplicate);
      return;
    }

    const createdAuthors: { id: string; name: string }[] = [];
    const createdSubjects: { id: string; name: string }[] = [];
    const createdKnowledgeAreas: { id: string; name: string }[] = [];

    let authorIds: string[] = [];
    if (data.authorIds.length > 0 || data.authorNames.length > 0) {
      const resolved = await resolveAuthorNames(data.authorNames);
      authorIds = [...new Set([...data.authorIds.map(String), ...resolved.ids])];
      createdAuthors.push(...resolved.created);
    }

    let subjectIds: string[] = [];
    if (data.subjectIds.length > 0 || data.subjectNames.length > 0) {
      const resolved = await resolveSubjectNames(data.subjectNames);
      subjectIds = [...new Set([...data.subjectIds.map(String), ...resolved.ids])];
      createdSubjects.push(...resolved.created);
    }

    let knowledgeAreaIds: string[] = [];
    if (data.knowledgeAreaIds.length > 0 || data.knowledgeAreaNames.length > 0) {
      const resolved = await resolveKnowledgeAreaNames(data.knowledgeAreaNames);
      knowledgeAreaIds = [...new Set([...data.knowledgeAreaIds.map(String), ...resolved.ids])];
      createdKnowledgeAreas.push(...resolved.created);
    }

    const authorNames = await buildNamesMap('authors', authorIds);
    const subNames = await buildNamesMap('subjects', subjectIds);
    const kaNames = await buildNamesMap('knowledgeAreas', knowledgeAreaIds);

    const book = await createDoc(COLLECTIONS.books, {
      title: data.title,
      subtitle: cleanNull(data.subtitle),
      isbn10: cleanNull(data.isbn10 ? normalizeIsbn(data.isbn10) : null),
      isbn13: cleanNull(data.isbn13 ? normalizeIsbn(data.isbn13) : null),
      description: cleanNull(data.description),
      publisher: cleanNull(data.publisher),
      edition: cleanInt(data.edition),
      publicationYear: cleanInt(data.publicationYear),
      language: cleanNull(data.language),
      pages: cleanInt(data.pages),
      coverUrl: cleanNull(data.coverUrl),
      format: cleanNull(data.format),
      volume: cleanNull(data.volume),
      cdd: cleanNull(data.cdd),
      cutter: cleanNull(data.cutter),
      physicalLocation: cleanNull(data.physicalLocation),
      availableCopies: cleanInt(data.availableCopies),
      acquisitionType: cleanNull(data.acquisitionType),
      isArchived: false,
      authorIds,
      authorNames,
      subjectIds,
      subjectNames: subNames,
      knowledgeAreaIds,
      knowledgeAreaNames: kaNames,
    });

    for (const a of createdAuthors) {
      await writeAudit(req.user?.id, 'AUTHOR_CREATED', 'Author', a.id, { name: a.name }, req.ip);
    }
    for (const s of createdSubjects) {
      await writeAudit(req.user?.id, 'SUBJECT_CREATED', 'Subject', s.id, { name: s.name }, req.ip);
    }
    for (const k of createdKnowledgeAreas) {
      await writeAudit(req.user?.id, 'KNOWLEDGE_AREA_CREATED', 'KnowledgeArea', k.id, { name: k.name }, req.ip);
    }
    await writeAudit(req.user?.id, 'BOOK_CREATED', 'Book', book.$id, { title: book.title }, req.ip);

    res.status(201).json(mapBook(book, true));
  }),
);

bookRouter.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const data = parse(bookSchema, req.body);
    const existing = await getDoc(COLLECTIONS.books, id);
    if (!existing) throw new HttpError(404, 'Livro não encontrado');

    const duplicate = await findDuplicateBook(providedIsbns(data), id);
    if (duplicate) {
      duplicateConflict(res, duplicate);
      return;
    }

    const createdAuthors: { id: string; name: string }[] = [];
    const createdSubjects: { id: string; name: string }[] = [];
    const createdKnowledgeAreas: { id: string; name: string }[] = [];

    const resolved = await resolveAuthorNames(data.authorNames);
    const authorIds = [...new Set([...data.authorIds.map(String), ...resolved.ids])];
    createdAuthors.push(...resolved.created);

    const resolvedSubjects = await resolveSubjectNames(data.subjectNames);
    const subjectIds = [...new Set([...data.subjectIds.map(String), ...resolvedSubjects.ids])];
    createdSubjects.push(...resolvedSubjects.created);

    const resolvedKnowledgeAreas = await resolveKnowledgeAreaNames(data.knowledgeAreaNames);
    const knowledgeAreaIds = [
      ...new Set([...data.knowledgeAreaIds.map(String), ...resolvedKnowledgeAreas.ids]),
    ];
    createdKnowledgeAreas.push(...resolvedKnowledgeAreas.created);

    const authorNames = await buildNamesMap('authors', authorIds);
    const subNames = await buildNamesMap('subjects', subjectIds);
    const kaNames = await buildNamesMap('knowledgeAreas', knowledgeAreaIds);

    const updated = await updateDoc(COLLECTIONS.books, id, {
      title: data.title,
      subtitle: cleanNull(data.subtitle),
      isbn10: cleanNull(data.isbn10 ? normalizeIsbn(data.isbn10) : null),
      isbn13: cleanNull(data.isbn13 ? normalizeIsbn(data.isbn13) : null),
      description: cleanNull(data.description),
      publisher: cleanNull(data.publisher),
      edition: cleanInt(data.edition),
      publicationYear: cleanInt(data.publicationYear),
      language: cleanNull(data.language),
      pages: cleanInt(data.pages),
      coverUrl: cleanNull(data.coverUrl),
      format: cleanNull(data.format),
      volume: cleanNull(data.volume),
      cdd: cleanNull(data.cdd),
      cutter: cleanNull(data.cutter),
      physicalLocation: cleanNull(data.physicalLocation),
      availableCopies: cleanInt(data.availableCopies),
      acquisitionType: cleanNull(data.acquisitionType),
      authorIds,
      authorNames,
      subjectIds,
      subjectNames: subNames,
      knowledgeAreaIds,
      knowledgeAreaNames: kaNames,
    });

    for (const a of createdAuthors) {
      await writeAudit(req.user?.id, 'AUTHOR_CREATED', 'Author', a.id, { name: a.name }, req.ip);
    }
    for (const s of createdSubjects) {
      await writeAudit(req.user?.id, 'SUBJECT_CREATED', 'Subject', s.id, { name: s.name }, req.ip);
    }
    for (const k of createdKnowledgeAreas) {
      await writeAudit(req.user?.id, 'KNOWLEDGE_AREA_CREATED', 'KnowledgeArea', k.id, { name: k.name }, req.ip);
    }
    await writeAudit(req.user?.id, 'BOOK_UPDATED', 'Book', id, { title: data.title }, req.ip);

    const { docs: allLoans } = await listDocs(COLLECTIONS.loans, { pageSize: 1000 });
    const activeLoanCount = allLoans.filter(
      (l) => String(l.bookId) === id && ACTIVE_LOAN_STATUSES.includes(l.status),
    ).length;

    res.json(mapBook(updated, activeLoanCount === 0));
  }),
);

bookRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await getDoc(COLLECTIONS.books, id);
    if (!existing) throw new HttpError(404, 'Livro não encontrado');
    const archived = await updateDoc(COLLECTIONS.books, id, { isArchived: true });
    await writeAudit(req.user?.id, 'BOOK_ARCHIVED', 'Book', id, { title: archived.title }, req.ip);
    res.json({ ok: true, isArchived: true });
  }),
);

bookRouter.patch(
  '/:id/restore',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await getDoc(COLLECTIONS.books, id);
    if (!existing) throw new HttpError(404, 'Livro não encontrado');
    const restored = await updateDoc(COLLECTIONS.books, id, { isArchived: false });
    await writeAudit(req.user?.id, 'BOOK_RESTORED', 'Book', id, { title: restored.title }, req.ip);
    res.json({ ok: true, isArchived: false });
  }),
);
