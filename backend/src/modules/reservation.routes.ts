import { Router } from 'express';
import prisma from '../lib/prisma';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { expireReservations, computeDueDate } from '../lib/overdue';
import { getSettings } from '../lib/settings';
import { parse, reservationCreateSchema, reservationQuerySchema } from '../validation';

export const reservationRouter = Router();

reservationRouter.use(requireAuth);

export const reservationInclude = {
  reader: true,
  book: true,
};

const RESERVATION_DAYS = 3;

reservationRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    await expireReservations();
    const q = parse(reservationQuerySchema, req.query);
    const where = {
      ...(q.status && q.status !== 'all' ? { status: q.status } : {}),
      ...(q.readerId ? { readerId: q.readerId } : {}),
      ...(q.bookId ? { bookId: q.bookId } : {}),
      ...(q.search ? { reader: { name: { contains: q.search } } } : {}),
    };
    const total = await prisma.reservation.count({ where });
    const items = await prisma.reservation.findMany({
      where,
      include: reservationInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    res.json({ items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

reservationRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(reservationCreateSchema, req.body);
    const reader = await prisma.reader.findUnique({ where: { id: data.readerId } });
    if (!reader) throw new HttpError(404, 'Leitor não encontrado');
    if (reader.status !== 'ACTIVE') throw new HttpError(400, 'Leitor bloqueado não pode reservar');
    const book = await prisma.book.findUnique({ where: { id: data.bookId } });
    if (!book) throw new HttpError(404, 'Livro não encontrado');

    const pending = await prisma.reservation.findFirst({
      where: { readerId: data.readerId, bookId: data.bookId, status: { in: ['PENDING', 'AVAILABLE'] } },
    });
    if (pending) throw new HttpError(400, 'Leitor já possui reserva ativa para este livro');

    const reservation = await prisma.reservation.create({
      data: {
        readerId: data.readerId,
        bookId: data.bookId,
        expiresAt: new Date(Date.now() + RESERVATION_DAYS * 86400000),
      },
    });
    await writeAudit(req.user?.id, 'RESERVATION_CREATED', 'Reservation', reservation.id, { readerId: data.readerId, bookId: data.bookId }, req.ip);
    res.status(201).json(reservation);
  }),
);

reservationRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Reserva não encontrada');
    if (existing.status === 'FULFILLED') throw new HttpError(400, 'Reserva já atendida não pode ser cancelada');
    const reservation = await prisma.reservation.update({ where: { id }, data: { status: 'CANCELLED' } });
    await writeAudit(req.user?.id, 'RESERVATION_CANCELLED', 'Reservation', id, undefined, req.ip);
    res.json(reservation);
  }),
);

reservationRouter.post(
  '/:id/fulfill',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const reservation = await prisma.reservation.findUnique({ where: { id }, include: { reader: true } });
    if (!reservation) throw new HttpError(404, 'Reserva não encontrada');
    if (reservation.status === 'CANCELLED' || reservation.status === 'EXPIRED') {
      throw new HttpError(400, 'Reserva cancelada ou expirada não pode ser atendida');
    }
    if (reservation.status === 'FULFILLED') throw new HttpError(400, 'Reserva já atendida');
    if (reservation.reader.status !== 'ACTIVE') throw new HttpError(400, 'Leitor bloqueado não pode retirar reserva');

    const settings = await getSettings();
    const dueDate = computeDueDate(new Date(), settings.defaultLoanDays);

    const { loan, number } = await prisma.$transaction(async (tx) => {
      const activeBookLoan = await tx.loan.findFirst({
        where: { bookId: reservation.bookId, status: { in: ['ACTIVE', 'OVERDUE'] } },
      });
      if (activeBookLoan) throw new HttpError(400, 'Este livro já está emprestado');

      const roster = await tx.loan.count({
        where: { readerId: reservation.readerId, status: { in: ['ACTIVE', 'OVERDUE'] } },
      });
      if (roster >= settings.loanLimit) {
        throw new HttpError(400, `Limite de empréstimos do leitor atingido (${settings.loanLimit})`);
      }

      const created = await tx.loan.create({
        data: { readerId: reservation.readerId, bookId: reservation.bookId, userId: req.user!.id, dueDate },
      });
      await tx.reservation.update({
        where: { id },
        data: { status: 'FULFILLED', fulfilledAt: new Date() },
      });
      const number = `EMP-${String(created.id).padStart(6, '0')}`;
      await tx.loan.update({ where: { id: created.id }, data: { number } });
      return { loan: created, number };
    });
    await writeAudit(req.user?.id, 'RESERVATION_FULFILLED', 'Reservation', id, { loanId: loan.id }, req.ip);
    await writeAudit(req.user?.id, 'LOAN_CREATED', 'Loan', loan.id, { number, viaReservation: id }, req.ip);
    res.status(201).json({ loanId: loan.id, number });
  }),
);