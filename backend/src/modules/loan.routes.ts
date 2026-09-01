import { Router } from 'express';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { listDocs, getDoc, createDoc, updateDoc, COLLECTIONS, type Doc } from '../lib/store';
import { computeDueDate, expireReservations, refreshOverdue } from '../lib/overdue';
import { getSettings } from '../lib/settings';
import { generateLoanTermPDF, generateReturnTermPDF } from '../lib/terms';
import { dateOrNull, loanQuerySchema, loanReturnSchema, parse } from '../validation';

export const loanRouter = Router();

const ACTIVE_STATUSES = ['ACTIVE', 'OVERDUE'];

let loanNumberCounter = 0;
async function nextLoanNumber(): Promise<string> {
  const res = await listDocs(COLLECTIONS.loans, { pageSize: 1000 });
  const base = res.total + 1 + loanNumberCounter++;
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `EMP-${ymd}-${String(base).padStart(4, '0')}`;
}

async function listAllLoans(): Promise<Doc[]> {
  const res = await listDocs(COLLECTIONS.loans, { pageSize: 1000 });
  return res.docs;
}

async function listAllReservations(): Promise<Doc[]> {
  const res = await listDocs(COLLECTIONS.reservations, { pageSize: 1000 });
  return res.docs;
}

function readBookIds(body: any): string[] {
  const raw = Array.isArray(body?.bookIds) ? body.bookIds : [];
  return raw.map((v: unknown) => String(v));
}

async function assertBookEligible(
  bookId: string,
  readerId: string,
  loans: Doc[],
  reservations: Doc[],
): Promise<{ id: string; title: string }> {
  const book = await getDoc(COLLECTIONS.books, bookId);
  if (!book) throw new HttpError(404, 'Livro não encontrado');
  if (book.isArchived) throw new HttpError(400, 'Livro arquivado não pode ser emprestado');
  const activeBookLoan = loans.find(
    (l) => l.bookId === bookId && ACTIVE_STATUSES.includes(l.status),
  );
  if (activeBookLoan) throw new HttpError(400, `"${book.title}" já está emprestado`);
  const reservation = reservations.find(
    (r) =>
      r.bookId === bookId &&
      ['PENDING', 'AVAILABLE'].includes(r.status) &&
      r.readerId !== readerId,
  );
  if (reservation) throw new HttpError(400, `"${book.title}" possui reserva aguardando por outro leitor`);
  return { id: book.$id, title: book.title };
}

async function buildLoanSnapshots(readerId: string, bookId: string, userId: string) {
  const [reader, book, user] = await Promise.all([
    getDoc(COLLECTIONS.readers, readerId),
    getDoc(COLLECTIONS.books, bookId),
    getDoc(COLLECTIONS.users, userId),
  ]);

  let authorSnapshot: string | null = null;
  if (Array.isArray(book?.authorNames) && book.authorNames.length > 0) {
    authorSnapshot = book.authorNames.join(', ');
  }
  const storedNum = book?.bookNumber != null && book.bookNumber !== '' ? String(book.bookNumber) : null;

  return {
    readerNameSnapshot: reader?.name ?? null,
    bookTitleSnapshot: book?.title ?? null,
    bookAuthorSnapshot: authorSnapshot,
    bookIsbnSnapshot: book?.isbn13 ?? book?.isbn10 ?? null,
    bookNumberSnapshot: storedNum ?? book?.$id ?? null,
    createdByNameSnapshot: user?.name ?? null,
  };
}

function loanData(number: string, readerId: string, bookId: string, userId: string, dueDate: Date, snapshots: object) {
  return {
    number,
    readerId,
    bookId,
    userId,
    loanDate: new Date().toISOString(),
    dueDate: dueDate.toISOString(),
    returnedAt: null,
    renewals: 0,
    notes: null,
    status: 'ACTIVE',
    ...snapshots,
  };
}

loanRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    await refreshOverdue();
    await expireReservations();
    const q = parse(loanQuerySchema, req.query);
    const resList = await listDocs(COLLECTIONS.loans, {
      pageSize: 1000,
      orderBy: { attr: 'createdAt', direction: 'desc' },
    });
    const startT = q.start ? new Date(q.start).getTime() : null;
    const endT = q.end ? new Date(q.end).getTime() : null;
    const search = q.search?.toLowerCase();

    let items = resList.docs.filter((loan) => {
      if (q.status === 'ACTIVE' && !ACTIVE_STATUSES.includes(loan.status)) return false;
      if (q.status === 'OVERDUE' && loan.status !== 'OVERDUE') return false;
      if (q.status === 'RETURNED' && loan.status !== 'RETURNED') return false;
      if (q.readerId && loan.readerId !== String(q.readerId)) return false;
      if (startT !== null || endT !== null) {
        const t = new Date(loan.createdAt).getTime();
        if (startT !== null && t < startT) return false;
        if (endT !== null && t > endT) return false;
      }
      if (search) {
        const hay = [loan.number, loan.readerNameSnapshot, loan.bookTitleSnapshot, loan.bookIsbnSnapshot];
        if (!hay.some((h) => h && String(h).toLowerCase().includes(search))) return false;
      }
      return true;
    });

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = items.length;
    const start = (q.page - 1) * q.pageSize;
    items = items.slice(start, start + q.pageSize);
    res.json({ items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

loanRouter.get(
  '/search',
  requireAuth,
  asyncHandler(async (req, res) => {
    const qText = String(req.query.q || '').trim();
    if (!qText) {
      res.json({ items: [] });
      return;
    }
    await refreshOverdue();
    const resList = await listDocs(COLLECTIONS.loans, {
      pageSize: 1000,
      orderBy: { attr: 'createdAt', direction: 'desc' },
    });
    const s = qText.toLowerCase();
    const items = resList.docs
      .filter((loan) => ACTIVE_STATUSES.includes(loan.status))
      .filter((loan) => {
        const hay = [loan.number, loan.readerNameSnapshot, loan.bookTitleSnapshot, loan.bookIsbnSnapshot];
        return hay.some((h) => h && String(h).toLowerCase().includes(s));
      })
      .slice(0, 20);
    res.json({ items });
  }),
);

loanRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const readerId = String(body.readerId ?? '');
    const bookId = String(body.bookId ?? '');
    const userId = req.user!.id;
    if (!readerId) throw new HttpError(400, 'readerId obrigatório');
    if (!bookId) throw new HttpError(400, 'bookId obrigatório');
    const settings = await getSettings();

    await refreshOverdue(readerId);

    const reader = await getDoc(COLLECTIONS.readers, readerId);
    if (!reader) throw new HttpError(404, 'Leitor não encontrado');
    if (reader.deletedAt) throw new HttpError(400, 'Leitor excluido nao pode emprestar');
    if (reader.status !== 'ACTIVE') throw new HttpError(400, 'Leitor bloqueado ou inativo não pode emprestar');

    const loans = await listAllLoans();
    const reservations = await listAllReservations();
    await assertBookEligible(bookId, readerId, loans, reservations);

    const overdue = loans.find((l) => l.readerId === readerId && l.status === 'OVERDUE');
    if (overdue) throw new HttpError(400, 'Leitor possui empréstimo atrasado; regularize antes de emprestar');

    const activeCount = loans.filter(
      (l) => l.readerId === readerId && ACTIVE_STATUSES.includes(l.status),
    ).length;
    if (activeCount >= settings.loanLimit) {
      throw new HttpError(400, `Limite de ${settings.loanLimit} empréstimos ativos atingido`);
    }

    const loanDate = new Date();
    const dueDate = body.dueDate
      ? (dateOrNull(body.dueDate) ?? computeDueDate(loanDate, settings.defaultLoanDays))
      : computeDueDate(loanDate, settings.defaultLoanDays);
    if (!dueDate || dueDate.getTime() <= loanDate.getTime()) throw new HttpError(400, 'Prazo de devolução deve ser futuro');

    const snapshots = await buildLoanSnapshots(readerId, bookId, userId);
    const number = await nextLoanNumber();
    const created = await createDoc(
      COLLECTIONS.loans,
      loanData(number, readerId, bookId, userId, dueDate, snapshots),
    );

    await writeAudit(userId, 'LOAN_CREATED', 'Loan', created.$id, { number, readerId, bookId }, req.ip);
    res.status(201).json({ ...created, number });
  }),
);

loanRouter.post(
  '/batch',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const readerId = String(body.readerId ?? '');
    let bookIds = readBookIds(body);
    const userId = req.user!.id;
    if (!readerId) throw new HttpError(400, 'readerId obrigatório');
    if (bookIds.length === 0) throw new HttpError(400, 'Selecione ao menos um livro');
    if (bookIds.length > 20) throw new HttpError(400, 'Máximo de 20 livros por pedido');
    const settings = await getSettings();

    await refreshOverdue(readerId);

    const loanDate = new Date();
    const dueDate = body.dueDate
      ? (dateOrNull(body.dueDate) ?? computeDueDate(loanDate, settings.defaultLoanDays))
      : computeDueDate(loanDate, settings.defaultLoanDays);
    if (!dueDate || dueDate.getTime() <= loanDate.getTime()) throw new HttpError(400, 'Prazo de devolução deve ser futuro');

    bookIds = [...new Set(bookIds)];
    if (bookIds.length !== readBookIds(req.body).length) throw new HttpError(400, 'Livro duplicado na seleção');

    const reader = await getDoc(COLLECTIONS.readers, readerId);
    if (!reader) throw new HttpError(404, 'Leitor não encontrado');
    if (reader.deletedAt) throw new HttpError(400, 'Leitor excluido nao pode emprestar');
    if (reader.status !== 'ACTIVE') throw new HttpError(400, 'Leitor bloqueado ou inativo não pode emprestar');

    const loans = await listAllLoans();
    const reservations = await listAllReservations();

    const overdue = loans.find((l) => l.readerId === readerId && l.status === 'OVERDUE');
    if (overdue) throw new HttpError(400, 'Leitor possui empréstimo atrasado; regularize antes de emprestar');

    const activeCount = loans.filter(
      (l) => l.readerId === readerId && ACTIVE_STATUSES.includes(l.status),
    ).length;
    if (activeCount + bookIds.length > settings.loanLimit) {
      throw new HttpError(
        400,
        `Limite de ${settings.loanLimit} empréstimos ativos atingido (${activeCount} ativos + ${bookIds.length} selecionados)`,
      );
    }

    const validated: { bookId: string; snapshots: object }[] = [];
    for (const bookId of bookIds) {
      await assertBookEligible(bookId, readerId, loans, reservations);
      validated.push({ bookId, snapshots: await buildLoanSnapshots(readerId, bookId, userId) });
    }

    const created: { id: string; number: string; bookId: string }[] = [];
    for (const v of validated) {
      const number = await nextLoanNumber();
      const l = await createDoc(
        COLLECTIONS.loans,
        loanData(number, readerId, v.bookId, userId, dueDate, v.snapshots),
      );
      created.push({ id: l.$id, number, bookId: v.bookId });
    }

    for (const l of created) {
      await writeAudit(userId, 'LOAN_CREATED', 'Loan', l.id, { number: l.number, readerId, bookId: l.bookId }, req.ip);
    }

    const full: Doc[] = [];
    for (const l of created) {
      const doc = await getDoc(COLLECTIONS.loans, l.id);
      if (doc) full.push(doc);
    }
    full.sort((a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime());
    res.status(201).json({ items: full, count: full.length });
  }),
);

loanRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const loan = await getDoc(COLLECTIONS.loans, id);
    if (!loan) throw new HttpError(404, 'Empréstimo não encontrado');
    res.json(loan);
  }),
);

loanRouter.post(
  '/:id/return',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const data = req.body && Object.keys(req.body).length > 0 ? parse(loanReturnSchema, req.body) : {};
    const loan = await getDoc(COLLECTIONS.loans, id);
    if (!loan) throw new HttpError(404, 'Empréstimo não encontrado');
    if (loan.returnedAt) throw new HttpError(400, 'Empréstimo já devolvido');

    const returned = await updateDoc(COLLECTIONS.loans, id, {
      returnedAt: new Date().toISOString(),
      status: 'RETURNED',
      returnCondition: data.condition ?? null,
      returnObservations: data.observations ?? null,
      receivedByNameSnapshot: req.user!.name,
    });

    const reservations = await listAllReservations();
    const pending = reservations
      .filter((r) => r.bookId === loan.bookId && r.status === 'PENDING')
      .sort((a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime())[0];
    if (pending) {
      const expired = pending.expiresAt && new Date(pending.expiresAt).getTime() < Date.now();
      await updateDoc(COLLECTIONS.reservations, pending.$id, {
        status: expired ? 'EXPIRED' : 'AVAILABLE',
      });
    }

    const allLoans = await listAllLoans();
    const overdueCount = allLoans.filter(
      (l) => l.readerId === loan.readerId && l.status === 'OVERDUE',
    ).length;
    if (overdueCount >= 2) {
      const reader = await getDoc(COLLECTIONS.readers, loan.readerId);
      if (reader && reader.status === 'ACTIVE') {
        await updateDoc(COLLECTIONS.readers, loan.readerId, {
          status: 'BLOCKED',
          blockCategory: 'ATRASO_REPETIDO',
          blockReason: 'Bloqueado automaticamente por atrasos repetidos',
          blockedAt: new Date().toISOString(),
          blockedBy: null,
        });
        const readerPending = reservations.filter(
          (r) => r.readerId === loan.readerId && r.status === 'PENDING',
        );
        for (const r of readerPending) {
          await updateDoc(COLLECTIONS.reservations, r.$id, { status: 'CANCELLED' });
        }
        await writeAudit(null, 'READER_STATUS_CHANGED', 'Reader', loan.readerId, {
          status: 'BLOCKED',
          reason: 'Bloqueado automaticamente por atrasos repetidos',
          category: 'ATRASO_REPETIDO',
          auto: true,
        }, req.ip);
      }
    }

    await writeAudit(req.user?.id, 'LOAN_RETURNED', 'Loan', id, { number: loan.number }, req.ip);
    res.json({ ...returned, number: loan.number });
  }),
);

loanRouter.post(
  '/:id/renew',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const loan = await getDoc(COLLECTIONS.loans, id);
    if (!loan) throw new HttpError(404, 'Empréstimo não encontrado');
    if (loan.status === 'RETURNED' || loan.returnedAt) throw new HttpError(400, 'Empréstimo já devolvido');
    if (loan.status === 'OVERDUE') throw new HttpError(400, 'Empréstimo atrasado não pode ser renovado');

    const reader = await getDoc(COLLECTIONS.readers, loan.readerId);
    if (!reader) throw new HttpError(404, 'Leitor não encontrado');
    if (reader.deletedAt) throw new HttpError(400, 'Leitor excluído não pode renovar');
    if (reader.status !== 'ACTIVE') throw new HttpError(400, 'Leitor bloqueado ou inativo não pode renovar');

    const settings = await getSettings();
    if ((loan.renewals ?? 0) >= settings.maxRenewals) {
      throw new HttpError(400, `Limite de ${settings.maxRenewals} renovação(ões) atingido`);
    }
    const reservations = await listAllReservations();
    const reservation = reservations.find(
      (r) => r.bookId === loan.bookId && ['PENDING', 'AVAILABLE'].includes(r.status),
    );
    if (reservation) throw new HttpError(400, 'Há uma reserva para este livro; não é possível renovar');

    const base = new Date(loan.dueDate).getTime() > Date.now() ? new Date(loan.dueDate) : new Date();
    const newDueDate = computeDueDate(base, settings.defaultLoanDays);
    const renewed = await updateDoc(COLLECTIONS.loans, id, {
      dueDate: newDueDate.toISOString(),
      renewals: (loan.renewals ?? 0) + 1,
    });
    await writeAudit(req.user?.id, 'LOAN_RENEWED', 'Loan', id, { number: loan.number, dueDate: newDueDate.toISOString() }, req.ip);
    res.json({ ...renewed, number: loan.number });
  }),
);

loanRouter.get(
  '/:id/term',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const loan = await getDoc(COLLECTIONS.loans, id);
    if (!loan) throw new HttpError(404, 'Empréstimo não encontrado');
    const settings = await getSettings();
    const termData = { ...loan, id: loan.$id };
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="termo-emprestimo-${loan.number || `EMP-${String(loan.$id).padStart(6, '0')}`}.pdf"`);
    const doc = generateLoanTermPDF(termData as any, settings);
    doc.pipe(res);
    doc.end();
  }),
);

loanRouter.get(
  '/:id/return-term',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const loan = await getDoc(COLLECTIONS.loans, id);
    if (!loan) throw new HttpError(404, 'Empréstimo não encontrado');
    if (!loan.returnedAt) throw new HttpError(404, 'Empréstimo ainda não devolvido');
    const settings = await getSettings();
    const termData = { ...loan, id: loan.$id };
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="termo-devolucao-DEV-${String(loan.$id).padStart(6, '0')}.pdf"`);
    const doc = generateReturnTermPDF(termData as any, settings);
    doc.pipe(res);
    doc.end();
  }),
);
