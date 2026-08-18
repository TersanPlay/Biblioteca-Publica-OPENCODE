import { Router } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { computeDueDate, expireReservations, refreshOverdue } from '../lib/overdue';
import { getSettings } from '../lib/settings';
import { dateOrNull, loanBatchCreateSchema, loanCreateSchema, loanQuerySchema, parse } from '../validation';

export const loanRouter = Router();

loanRouter.use(requireAuth);

export const loanInclude = {
  reader: true,
  book: true,
  user: { select: { id: true, name: true } },
};

async function ensureNumber(loanId: number, tx: Prisma.TransactionClient): Promise<string> {
  const number = `EMP-${String(loanId).padStart(6, '0')}`;
  await tx.loan.update({ where: { id: loanId }, data: { number } });
  return number;
}

async function assertBookEligible(
  tx: Prisma.TransactionClient,
  bookId: number,
  readerId: number,
): Promise<{ id: number; title: string }> {
  const book = await tx.book.findUnique({ where: { id: bookId } });
  if (!book) throw new HttpError(404, 'Livro não encontrado');
  if (book.isArchived) throw new HttpError(400, 'Livro arquivado não pode ser emprestado');
  const activeBookLoan = await tx.loan.findFirst({
    where: { bookId: book.id, status: { in: ['ACTIVE', 'OVERDUE'] } },
  });
  if (activeBookLoan) throw new HttpError(400, `"${book.title}" já está emprestado`);
  const reservation = await tx.reservation.findFirst({
    where: { bookId: book.id, status: { in: ['PENDING', 'AVAILABLE'] }, readerId: { not: readerId } },
  });
  if (reservation) throw new HttpError(400, `"${book.title}" possui reserva aguardando por outro leitor`);
  return { id: book.id, title: book.title };
}

loanRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    await refreshOverdue();
    await expireReservations();
    const q = parse(loanQuerySchema, req.query);
    const where: any = {
      ...(q.status === 'ACTIVE' ? { status: { in: ['ACTIVE', 'OVERDUE'] } } : {}),
      ...(q.status === 'OVERDUE' ? { status: 'OVERDUE' } : {}),
      ...(q.status === 'RETURNED' ? { status: 'RETURNED' } : {}),
      ...(q.readerId ? { readerId: q.readerId } : {}),
      ...(q.start || q.end
        ? { loanDate: { gte: dateOrNull(q.start) ?? undefined, lte: dateOrNull(q.end) ?? undefined } }
        : {}),
      ...(q.search
        ? {
            OR: [
              { number: { contains: q.search } },
              { reader: { name: { contains: q.search } } },
              { reader: { cpf: { contains: q.search } } },
              { book: { title: { contains: q.search } } },
              { book: { isbn10: { contains: q.search } } },
              { book: { isbn13: { contains: q.search } } },
            ],
          }
        : {}),
    };
    const total = await prisma.loan.count({ where });
    const items = await prisma.loan.findMany({
      where,
      include: loanInclude,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    res.json({ items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

loanRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const qText = String(req.query.q || '').trim();
    if (!qText) {
      res.json({ items: [] });
      return;
    }
    await refreshOverdue();
    const items = await prisma.loan.findMany({
      where: {
        status: { in: ['ACTIVE', 'OVERDUE'] },
        OR: [
          { number: { contains: qText } },
          { reader: { name: { contains: qText } } },
          { reader: { cpf: { contains: qText } } },
          { book: { title: { contains: qText } } },
          { book: { isbn10: { contains: qText } } },
          { book: { isbn13: { contains: qText } } },
        ],
      },
      include: loanInclude,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ items });
  }),
);

loanRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(loanCreateSchema, req.body);
    const userId = req.user!.id;
    const settings = await getSettings();

    await refreshOverdue(data.readerId);

    const { loan, number } = await prisma.$transaction(async (tx) => {
      const reader = await tx.reader.findUnique({ where: { id: data.readerId } });
      if (!reader) throw new HttpError(404, 'Leitor não encontrado');
      if (reader.status !== 'ACTIVE') throw new HttpError(400, 'Leitor bloqueado ou inativo não pode emprestar');

      await assertBookEligible(tx, data.bookId, reader.id);

      const overdue = await tx.loan.findFirst({
        where: { readerId: reader.id, status: 'OVERDUE' },
      });
      if (overdue) throw new HttpError(400, 'Leitor possui empréstimo atrasado; regularize antes de emprestar');

      const activeCount = await tx.loan.count({
        where: { readerId: reader.id, status: { in: ['ACTIVE', 'OVERDUE'] } },
      });
      if (activeCount >= settings.loanLimit) {
        throw new HttpError(400, `Limite de ${settings.loanLimit} empréstimos ativos atingido`);
      }

      const loanDate = new Date();
      const dueDate = data.dueDate
        ? (dateOrNull(data.dueDate) ?? computeDueDate(loanDate, settings.defaultLoanDays))
        : computeDueDate(loanDate, settings.defaultLoanDays);
      if (dueDate.getTime() <= loanDate.getTime()) throw new HttpError(400, 'Prazo de devolução deve ser futuro');

      const created = await tx.loan.create({
        data: { readerId: reader.id, bookId: data.bookId, userId, dueDate, status: 'ACTIVE' },
      });
      const number = await ensureNumber(created.id, tx);
      return { loan: created, number };
    });
    await writeAudit(userId, 'LOAN_CREATED', 'Loan', loan.id, { number, readerId: loan.readerId, bookId: loan.bookId }, req.ip);

    const full = await prisma.loan.findUnique({ where: { id: loan.id }, include: loanInclude });
    res.status(201).json({ ...full, number });
  }),
);

loanRouter.post(
  '/batch',
  asyncHandler(async (req, res) => {
    const data = parse(loanBatchCreateSchema, req.body);
    const userId = req.user!.id;
    const settings = await getSettings();

    await refreshOverdue(data.readerId);

    const loanDate = new Date();
    const dueDate = data.dueDate
      ? (dateOrNull(data.dueDate) ?? computeDueDate(loanDate, settings.defaultLoanDays))
      : computeDueDate(loanDate, settings.defaultLoanDays);
    if (dueDate.getTime() <= loanDate.getTime()) throw new HttpError(400, 'Prazo de devolução deve ser futuro');

    const bookIds = [...new Set(data.bookIds)];
    if (bookIds.length !== data.bookIds.length) throw new HttpError(400, 'Livro duplicado na seleção');

    const created = await prisma.$transaction(async (tx) => {
      const reader = await tx.reader.findUnique({ where: { id: data.readerId } });
      if (!reader) throw new HttpError(404, 'Leitor não encontrado');
      if (reader.status !== 'ACTIVE') throw new HttpError(400, 'Leitor bloqueado ou inativo não pode emprestar');

      const overdue = await tx.loan.findFirst({
        where: { readerId: reader.id, status: 'OVERDUE' },
      });
      if (overdue) throw new HttpError(400, 'Leitor possui empréstimo atrasado; regularize antes de emprestar');

      const activeCount = await tx.loan.count({
        where: { readerId: reader.id, status: { in: ['ACTIVE', 'OVERDUE'] } },
      });
      if (activeCount + bookIds.length > settings.loanLimit) {
        throw new HttpError(
          400,
          `Limite de ${settings.loanLimit} empréstimos ativos atingido (${activeCount} ativos + ${bookIds.length} selecionados)`,
        );
      }

      const loans: { id: number; number: string; bookId: number }[] = [];
      for (const bookId of bookIds) {
        await assertBookEligible(tx, bookId, reader.id);
        const createdLoan = await tx.loan.create({
          data: { readerId: reader.id, bookId, userId, dueDate, status: 'ACTIVE' },
        });
        const number = await ensureNumber(createdLoan.id, tx);
        loans.push({ id: createdLoan.id, number, bookId });
      }
      return loans;
    });

    for (const l of created) {
      await writeAudit(userId, 'LOAN_CREATED', 'Loan', l.id, { number: l.number, readerId: data.readerId, bookId: l.bookId }, req.ip);
    }

    const full = await prisma.loan.findMany({
      where: { id: { in: created.map((l) => l.id) } },
      include: loanInclude,
      orderBy: { createdAt: 'asc' },
    });
    res.status(201).json({ items: full, count: full.length });
  }),
);

loanRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const loan = await prisma.loan.findUnique({ where: { id }, include: loanInclude });
    if (!loan) throw new HttpError(404, 'Empréstimo não encontrado');
    res.json(loan);
  }),
);

loanRouter.post(
  '/:id/return',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new HttpError(404, 'Empréstimo não encontrado');
    if (loan.returnedAt) throw new HttpError(400, 'Empréstimo já devolvido');

    const returned = await prisma.loan.update({
      where: { id },
      data: { returnedAt: new Date(), status: 'RETURNED' },
    });

    const pending = await prisma.reservation.findFirst({
      where: { bookId: loan.bookId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    if (pending) {
      const expired = pending.expiresAt && pending.expiresAt.getTime() < Date.now();
      await prisma.reservation.update({
        where: { id: pending.id },
        data: { status: expired ? 'EXPIRED' : 'AVAILABLE' },
      });
    }

    await writeAudit(req.user?.id, 'LOAN_RETURNED', 'Loan', id, { number: loan.number }, req.ip);
    res.json({ ...returned, number: loan.number });
  }),
);

loanRouter.post(
  '/:id/renew',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { reader: true },
    });
    if (!loan) throw new HttpError(404, 'Empréstimo não encontrado');
    if (loan.status === 'RETURNED' || loan.returnedAt) throw new HttpError(400, 'Empréstimo já devolvido');
    if (loan.status === 'OVERDUE') throw new HttpError(400, 'Empréstimo atrasado não pode ser renovado');
    if (loan.reader.status !== 'ACTIVE') throw new HttpError(400, 'Leitor bloqueado ou inativo não pode renovar');

    const settings = await getSettings();
    if (loan.renewals >= settings.maxRenewals) {
      throw new HttpError(400, `Limite de ${settings.maxRenewals} renovação(ões) atingido`);
    }
    const reservation = await prisma.reservation.findFirst({
      where: { bookId: loan.bookId, status: { in: ['PENDING', 'AVAILABLE'] } },
    });
    if (reservation) throw new HttpError(400, 'Há uma reserva para este livro; não é possível renovar');

    const base = loan.dueDate.getTime() > Date.now() ? loan.dueDate : new Date();
    const newDueDate = computeDueDate(base, settings.defaultLoanDays);
    const renewed = await prisma.loan.update({
      where: { id },
      data: { dueDate: newDueDate, renewals: { increment: 1 } },
    });
    await writeAudit(req.user?.id, 'LOAN_RENEWED', 'Loan', id, { number: loan.number, dueDate: newDueDate }, req.ip);
    res.json({ ...renewed, number: loan.number });
  }),
);
