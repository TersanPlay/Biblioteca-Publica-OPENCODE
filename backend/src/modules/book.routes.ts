import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { bookQuerySchema, bookSchema, cleanInt, cleanNull, normalizeIsbn, parse } from '../validation';
import { resolveBookMetadata } from '../lib/cover';
import { coverLimiter } from '../middleware/cover-rate-limit';

export const bookRouter = Router();

export const bookInclude = {
  categories: { include: { category: true } },
  authors: { include: { author: true } },
};

const ACTIVE_LOAN_STATUSES = ['ACTIVE', 'OVERDUE'];

async function resolveAuthorNames(
  tx: Prisma.TransactionClient,
  names: string[],
): Promise<{ ids: number[]; created: { id: number; name: string }[] }> {
  const ids: number[] = [];
  const created: { id: number; name: string }[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const all = await tx.author.findMany({ select: { id: true, name: true } });
    const existing = all.find((a) => a.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const author = await tx.author.create({ data: { name } });
    created.push({ id: author.id, name: author.name });
    ids.push(author.id);
  }
  return { ids, created };
}

async function resolveCategoryNames(
  tx: Prisma.TransactionClient,
  names: string[],
): Promise<{ ids: number[]; created: { id: number; name: string }[] }> {
  const ids: number[] = [];
  const created: { id: number; name: string }[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const all = await tx.category.findMany({ select: { id: true, name: true } });
    const existing = all.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const category = await tx.category.create({ data: { name } });
    created.push({ id: category.id, name: category.name });
    ids.push(category.id);
  }
  return { ids, created };
}

function mapBook(b: any, isAvailable: boolean) {
  return {
    ...b,
    categories: (b.categories ?? []).map((c: any) => c.category),
    isAvailable,
  };
}

async function loanedBookIds(): Promise<Set<number>> {
  const loans = await prisma.loan.findMany({
    where: { status: { in: ACTIVE_LOAN_STATUSES } },
    select: { bookId: true },
    distinct: ['bookId'],
  });
  return new Set(loans.map((l) => l.bookId));
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

async function findDuplicateBook(isbns: string[], excludeId?: number) {
  if (isbns.length === 0) return null;
  return prisma.book.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [{ isbn10: { in: isbns } }, { isbn13: { in: isbns } }],
    },
    select: { id: true, title: true, isbn10: true, isbn13: true },
  });
}

function duplicateConflict(res: any, duplicate: NonNullable<Awaited<ReturnType<typeof findDuplicateBook>>>) {
  res.status(409).json({
    success: false,
    code: 'BOOK_ALREADY_EXISTS',
    message: 'Este livro já está cadastrado.',
    duplicate: {
      id: duplicate.id,
      titulo: duplicate.title,
      isbn10: duplicate.isbn10,
      isbn13: duplicate.isbn13,
    },
  });
}

bookRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(bookQuerySchema, req.query);
    const search = q.search;
    const where: any = {
isArchived: q.includeArchived ? undefined : false,
      ...(q.categoryId ? { categories: { some: { categoryId: q.categoryId } } } : {}),
      ...(search
        ? {
OR: [
              { title: { contains: search } },
              { subtitle: { contains: search } },
              { isbn10: { contains: search } },
              { isbn13: { contains: search } },
              { publisher: { contains: search } },
              { authors: { some: { author: { name: { contains: search } } } } },
            ],
          }
        : {}),
    };
    let loanedIds: Set<number> = new Set();
    if (q.availability) {
      loanedIds = await loanedBookIds();
      if (loanedIds.size === 0 && q.availability === 'available') {
        res.json({ items: [], total: 0, page: q.page, pageSize: q.pageSize, totalPages: 0 });
        return;
      }
      if (q.availability === 'available') {
        where.id = { notIn: Array.from(loanedIds) };
      } else {
        where.id = { in: Array.from(loanedIds) };
      }
    }

    const total = await prisma.book.count({ where });
    const orderBy: any =
      q.sort === 'title'
        ? { title: 'asc' as const }
        : q.sort === 'oldest'
          ? { createdAt: 'asc' as const }
          : { createdAt: 'desc' as const };

    const items = await prisma.book.findMany({
      where,
      include: bookInclude,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    if (loanedIds.size === 0) loanedIds = await loanedBookIds();
    res.json({
      items: items.map((b) => mapBook(b, !loanedIds.has(b.id))),
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
    const exclude = Number(req.query.exclude) || undefined;
    const book = await prisma.book.findFirst({
      where: {
        ...(exclude ? { id: { not: exclude } } : {}),
        OR: [{ isbn10: isbn }, { isbn13: isbn }],
      },
      select: { id: true, title: true, isbn10: true, isbn13: true },
    });
    res.json({ book });
  }),
);

bookRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Livro não encontrado');
    const book = await prisma.book.findUnique({ where: { id }, include: bookInclude });
    if (!book) throw new HttpError(404, 'Livro não encontrado');
    const [loans, activeLoans] = await Promise.all([
      prisma.loan.findMany({
        where: { bookId: id },
        include: { reader: true, book: true, user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.loan.count({
        where: { bookId: id, status: { in: ACTIVE_LOAN_STATUSES } },
      }),
    ]);
    res.json({ ...mapBook(book, activeLoans === 0), loans, hasActiveLoan: activeLoans > 0 });
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
    const result = await prisma.$transaction(async (tx) => {
      const createdAuthors: { id: number; name: string }[] = [];
      const createdCategories: { id: number; name: string }[] = [];
      const book = await tx.book.create({
        data: {
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
        },
      });
      if (data.authorIds.length > 0 || data.authorNames.length > 0) {
        const resolved = await resolveAuthorNames(tx, data.authorNames);
        const authorIds = [...new Set([...data.authorIds, ...resolved.ids])];
        await tx.bookAuthor.createMany({
          data: authorIds.map((authorId) => ({ bookId: book.id, authorId })),
        });
        createdAuthors.push(...resolved.created);
      }
      if (data.categoryIds.length > 0 || data.categoryNames.length > 0) {
        const resolved = await resolveCategoryNames(tx, data.categoryNames);
        const categoryIds = [...new Set([...data.categoryIds, ...resolved.ids])];
        await tx.bookCategory.createMany({
          data: categoryIds.map((categoryId) => ({ bookId: book.id, categoryId })),
        });
        createdCategories.push(...resolved.created);
      }
      return { book, createdAuthors, createdCategories };
    });
    for (const a of result.createdAuthors) {
      await writeAudit(req.user?.id, 'AUTHOR_CREATED', 'Author', a.id, { name: a.name }, req.ip);
    }
    for (const c of result.createdCategories) {
      await writeAudit(req.user?.id, 'CATEGORY_CREATED', 'Category', c.id, { name: c.name }, req.ip);
    }
    await writeAudit(req.user?.id, 'BOOK_CREATED', 'Book', result.book.id, { title: result.book.title }, req.ip);
    const full = await prisma.book.findUnique({ where: { id: result.book.id }, include: bookInclude });
    res.status(201).json(mapBook(full!, true));
  }),
);

bookRouter.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
const id = Number(req.params.id);
    const data = parse(bookSchema, req.body);
    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Livro não encontrado');
    const duplicate = await findDuplicateBook(providedIsbns(data), id);
    if (duplicate) {
      duplicateConflict(res, duplicate);
      return;
    }
const createdAuthors: { id: number; name: string }[] = [];
    const createdCategories: { id: number; name: string }[] = [];
    await prisma.$transaction(async (tx) => {
      await tx.book.update({
        where: { id },
        data: {
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
        },
      });
      await tx.bookAuthor.deleteMany({ where: { bookId: id } });
      const resolved = await resolveAuthorNames(tx, data.authorNames);
      const authorIds = [...new Set([...data.authorIds, ...resolved.ids])];
      if (authorIds.length > 0) {
        await tx.bookAuthor.createMany({
          data: authorIds.map((authorId) => ({ bookId: id, authorId })),
        });
      }
      createdAuthors.push(...resolved.created);
      await tx.bookCategory.deleteMany({ where: { bookId: id } });
      const resolvedCategories = await resolveCategoryNames(tx, data.categoryNames);
      const categoryIds = [...new Set([...data.categoryIds, ...resolvedCategories.ids])];
      if (categoryIds.length > 0) {
        await tx.bookCategory.createMany({
          data: categoryIds.map((categoryId) => ({ bookId: id, categoryId })),
        });
      }
      createdCategories.push(...resolvedCategories.created);
    });
    for (const a of createdAuthors) {
      await writeAudit(req.user?.id, 'AUTHOR_CREATED', 'Author', a.id, { name: a.name }, req.ip);
    }
    for (const c of createdCategories) {
      await writeAudit(req.user?.id, 'CATEGORY_CREATED', 'Category', c.id, { name: c.name }, req.ip);
    }
    await writeAudit(req.user?.id, 'BOOK_UPDATED', 'Book', id, { title: data.title }, req.ip);
    const full = await prisma.book.findUnique({ where: { id }, include: bookInclude });
    const activeLoans = await prisma.loan.count({
      where: { bookId: id, status: { in: ACTIVE_LOAN_STATUSES } },
    });
    res.json(mapBook(full!, activeLoans === 0));
  }),
);

bookRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Livro não encontrado');
    const archived = await prisma.book.update({ where: { id }, data: { isArchived: true } });
    await writeAudit(req.user?.id, 'BOOK_ARCHIVED', 'Book', id, { title: archived.title }, req.ip);
    res.json({ ok: true, isArchived: true });
  }),
);

bookRouter.patch(
  '/:id/restore',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Livro não encontrado');
    const restored = await prisma.book.update({ where: { id }, data: { isArchived: false } });
    await writeAudit(req.user?.id, 'BOOK_RESTORED', 'Book', id, { title: restored.title }, req.ip);
    res.json({ ok: true, isArchived: false });
  }),
);
