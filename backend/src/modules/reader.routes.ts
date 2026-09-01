import { Router } from 'express';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import {
  listDocs,
  createDoc,
  getDoc,
  updateDoc,
  findDocBy,
  countDocs,
  COLLECTIONS,
  type Doc,
} from '../lib/store';
import { Query } from '../lib/appwrite';
import {
  cleanNull,
  dateOrNull,
  parse,
  paginationSchema,
  readerDeleteSchema,
  readerQuerySchema,
  readerSchema,
  readerStatusSchema,
  readerUpdateSchema,
} from '../validation';
import { refreshOverdue } from '../lib/overdue';

export const readerRouter = Router();

readerRouter.use(requireAuth);

function mapReader(r: Doc, activeLoans = 0) {
  return { ...r, activeLoans };
}

readerRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(readerQuerySchema, req.query);
    const search = q.search?.toLowerCase();

    const queries: string[] = [];

    if (q.status !== 'ALL') {
      queries.push(Query.equal('status', q.status));
    }

    const allReaders = await listDocs(COLLECTIONS.readers, {
      pageSize: 1000,
      orderBy: { attr: 'name', direction: 'asc' },
      queries,
    });

    let items = allReaders.docs.filter((r) => !r.deletedAt);
    if (search) {
      items = items.filter(
        (r) =>
          r.name?.toLowerCase().includes(search) ||
          r.cpf?.toLowerCase().includes(search) ||
          r.email?.toLowerCase().includes(search),
      );
    }

    const total = items.length;

    const activeLoansData = await listDocs(COLLECTIONS.loans, {
      pageSize: 1000,
      queries: [Query.equal('status', ['ACTIVE', 'OVERDUE'])],
    });
    const activeByReader: Record<string, number> = {};
    for (const loan of activeLoansData.docs) {
      activeByReader[loan.readerId] = (activeByReader[loan.readerId] ?? 0) + 1;
    }

    const start = (q.page - 1) * q.pageSize;
    const paged = items.slice(start, start + q.pageSize);

    res.json({
      items: paged.map((i) => mapReader(i, activeByReader[i.$id] ?? 0)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    });
  }),
);

readerRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(readerSchema, req.body);

    const cpfClash = await findDocBy(COLLECTIONS.readers, 'cpf', data.cpf);
    if (cpfClash) throw new HttpError(409, 'CPF já cadastrado');

    if (data.email) {
      const allReaders = await listDocs(COLLECTIONS.readers, { pageSize: 1000 });
      const emailClash = allReaders.docs.find(
        (r) => r.email?.toLowerCase() === data.email!.toLowerCase(),
      );
      if (emailClash) throw new HttpError(409, 'E-mail já cadastrado');
    }

    const birthDate = data.birthDate ? new Date(data.birthDate) : null;
    const isoBirth = birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate.toISOString() : null;

    const reader = await createDoc(COLLECTIONS.readers, {
      name: data.name,
      cpf: data.cpf,
      birthDate: isoBirth,
      phone: cleanNull(data.phone),
      email: cleanNull(data.email),
      cep: cleanNull(data.cep),
      address: cleanNull(data.address),
      number: cleanNull(data.number),
      neighborhood: cleanNull(data.neighborhood),
      city: cleanNull(data.city),
      state: cleanNull(data.state),
      status: 'ACTIVE',
      deletedAt: null,
      anonymizedAt: null,
      blockReason: null,
      blockCategory: null,
      blockedAt: null,
      blockedBy: null,
    });

    await writeAudit(req.user?.id, 'READER_CREATED', 'Reader', reader.$id, { name: reader.name }, req.ip);
    res.status(201).json(reader);
  }),
);

readerRouter.get(
  '/blocked',
  asyncHandler(async (req, res) => {
    const q = parse(paginationSchema, req.query);
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    const queries: string[] = [Query.equal('status', 'BLOCKED')];

    const allReaders = await listDocs(COLLECTIONS.readers, {
      pageSize: 1000,
      queries,
    });

    let items = allReaders.docs.filter((r) => !r.deletedAt);
    if (search) {
      items = items.filter(
        (r) =>
          r.name?.toLowerCase().includes(search) ||
          r.cpf?.toLowerCase().includes(search),
      );
    }

    items.sort((a, b) => {
      const aTime = a.blockedAt ? new Date(a.blockedAt).getTime() : 0;
      const bTime = b.blockedAt ? new Date(b.blockedAt).getTime() : 0;
      return bTime - aTime;
    });

    const total = items.length;

    const activeLoansData = await listDocs(COLLECTIONS.loans, {
      pageSize: 1000,
      queries: [Query.equal('status', ['ACTIVE', 'OVERDUE'])],
    });
    const activeByReader: Record<string, number> = {};
    for (const loan of activeLoansData.docs) {
      activeByReader[loan.readerId] = (activeByReader[loan.readerId] ?? 0) + 1;
    }

    const blockedUserIds = [...new Set(items.filter((i) => i.blockedBy).map((i) => i.blockedBy as string))];
    const blockedByNameMap: Record<string, string> = {};
    for (const uid of blockedUserIds) {
      const user = await getDoc(COLLECTIONS.users, uid);
      if (user) blockedByNameMap[uid] = user.name;
    }

    const start = (q.page - 1) * q.pageSize;
    const paged = items.slice(start, start + q.pageSize);

    res.json({
      items: paged.map((r) => ({
        ...r,
        activeLoans: activeByReader[r.$id] ?? 0,
        blockedByName: r.blockedBy ? blockedByNameMap[r.blockedBy] ?? null : null,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    });
  }),
);

readerRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const reader = await getDoc(COLLECTIONS.readers, id);
    if (!reader) throw new HttpError(404, 'Leitor não encontrado');

    await refreshOverdue(id);

    const [loansData, reservationsData] = await Promise.all([
      listDocs(COLLECTIONS.loans, {
        pageSize: 50,
        orderBy: { attr: 'createdAt', direction: 'desc' },
        queries: [Query.equal('readerId', id)],
      }),
      listDocs(COLLECTIONS.reservations, {
        pageSize: 20,
        orderBy: { attr: 'createdAt', direction: 'desc' },
        queries: [Query.equal('readerId', id)],
      }),
    ]);

    const loans: Doc[] = await Promise.all(
      loansData.docs.map(async (loan) => {
        let bookTitle = loan.bookTitleSnapshot ?? null;
        if (!bookTitle && loan.bookId) {
          const book = await getDoc(COLLECTIONS.books, loan.bookId);
          if (book) bookTitle = book.title;
        }
        return { ...loan, bookTitle };
      }),
    );

    const reservations: Doc[] = await Promise.all(
      reservationsData.docs.map(async (rsv) => {
        let bookTitle = rsv.bookTitleSnapshot ?? null;
        if (!bookTitle && rsv.bookId) {
          const book = await getDoc(COLLECTIONS.books, rsv.bookId);
          if (book) bookTitle = book.title;
        }
        return { ...rsv, bookTitle };
      }),
    );

    const activeLoans = loans.filter((l) => l.status !== 'RETURNED');
    const overdueCount = loans.filter((l) => l.status === 'OVERDUE').length;

    res.json({ reader, loans, activeLoans, overdueCount, reservations });
  }),
);

readerRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const data = parse(readerUpdateSchema, req.body);

    const existing = await getDoc(COLLECTIONS.readers, id);
    if (!existing) throw new HttpError(404, 'Leitor não encontrado');
    if (existing.deletedAt) throw new HttpError(409, 'Leitor excluído não pode ser editado');

    if (data.cpf && data.cpf !== existing.cpf) {
      const clash = await findDocBy(COLLECTIONS.readers, 'cpf', data.cpf);
      if (clash) throw new HttpError(409, 'CPF já cadastrado');
    }

    if (data.email && data.email !== existing.email) {
      const allReaders = await listDocs(COLLECTIONS.readers, { pageSize: 1000 });
      const emailClash = allReaders.docs.find(
        (r) => r.$id !== id && r.email?.toLowerCase() === data.email!.toLowerCase(),
      );
      if (emailClash) throw new HttpError(409, 'E-mail já cadastrado');
    }

    let isoBirth: string | null | undefined;
    if (data.birthDate !== undefined) {
      const d = dateOrNull(data.birthDate);
      isoBirth = d ? d.toISOString() : null;
    }

    const patch: Record<string, unknown> = {
      name: data.name ?? existing.name,
      cpf: data.cpf ?? existing.cpf,
      phone: data.phone !== undefined ? cleanNull(data.phone) : existing.phone,
      email: data.email !== undefined ? cleanNull(data.email) : existing.email,
      cep: data.cep !== undefined ? cleanNull(data.cep) : existing.cep,
      address: data.address !== undefined ? cleanNull(data.address) : existing.address,
      number: data.number !== undefined ? cleanNull(data.number) : existing.number,
      neighborhood: data.neighborhood !== undefined ? cleanNull(data.neighborhood) : existing.neighborhood,
      city: data.city !== undefined ? cleanNull(data.city) : existing.city,
      state: data.state !== undefined ? cleanNull(data.state) : existing.state,
    };

    if (data.birthDate !== undefined) {
      patch.birthDate = isoBirth;
    }

    const reader = await updateDoc(COLLECTIONS.readers, id, patch);
    await writeAudit(req.user?.id, 'READER_UPDATED', 'Reader', id, { name: reader.name }, req.ip);
    res.json(reader);
  }),
);

readerRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { status, reason, category } = parse(readerStatusSchema, req.body);

    const existing = await getDoc(COLLECTIONS.readers, id);
    if (!existing) throw new HttpError(404, 'Leitor não encontrado');
    if (existing.deletedAt) throw new HttpError(409, 'Leitor excluído não pode ter status alterado');

    const data: Record<string, unknown> = { status };
    if (status === 'BLOCKED') {
      data.blockReason = reason ?? null;
      data.blockCategory = category ?? null;
      data.blockedAt = new Date().toISOString();
      data.blockedBy = req.user!.id;
    } else if (status === 'ACTIVE') {
      data.blockReason = null;
      data.blockCategory = null;
      data.blockedAt = null;
      data.blockedBy = null;
    }

    const reader = await updateDoc(COLLECTIONS.readers, id, data);
    await writeAudit(
      req.user?.id,
      'READER_STATUS_CHANGED',
      'Reader',
      id,
      { status, reason: reason ?? null, category: category ?? null },
      req.ip,
    );
    res.json(reader);
  }),
);

readerRouter.delete(
  '/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { reason } = parse(readerDeleteSchema, req.body ?? {});

    const existing = await getDoc(COLLECTIONS.readers, id);
    if (!existing) throw new HttpError(404, 'Leitor não encontrado');
    if (existing.deletedAt) throw new HttpError(409, 'Leitor já foi excluído');

    const loansData = await listDocs(COLLECTIONS.loans, {
      pageSize: 1000,
      queries: [Query.equal('readerId', id)],
    });
    const activeLoansCount = loansData.docs.filter(
      (l) => l.status === 'ACTIVE' || l.status === 'OVERDUE',
    ).length;
    if (activeLoansCount > 0) {
      throw new HttpError(409, 'Leitor possui empréstimos ativos ou em atraso e não pode ser excluído');
    }

    const reservationsData = await listDocs(COLLECTIONS.reservations, {
      pageSize: 1000,
      queries: [Query.equal('readerId', id)],
    });
    for (const res of reservationsData.docs) {
      if (res.status === 'PENDING' || res.status === 'AVAILABLE') {
        await updateDoc(COLLECTIONS.reservations, res.$id, { status: 'CANCELLED' });
      }
    }

    const last8 = id.slice(-8).toUpperCase();
    const padded = last8.padStart(6, '0');
    const now = new Date().toISOString();

    await updateDoc(COLLECTIONS.readers, id, {
      name: 'Leitor excluído',
      cpf: `EXCLUIDO-${padded}`,
      birthDate: null,
      phone: null,
      email: null,
      cep: null,
      address: null,
      number: null,
      neighborhood: null,
      city: null,
      state: null,
      status: 'INACTIVE',
      blockReason: null,
      blockCategory: null,
      blockedAt: null,
      blockedBy: null,
      deletedAt: now,
      anonymizedAt: now,
    });

    await writeAudit(
      req.user?.id,
      'READER_DELETED',
      'Reader',
      id,
      {
        reference: `LTR-${padded}`,
        previousName: existing.name,
        cancelledReservations: true,
        reason: reason ?? null,
      },
      req.ip,
    );
    res.json({ ok: true, deleted: true });
  }),
);
