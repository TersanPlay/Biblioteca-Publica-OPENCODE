import { Router } from 'express';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { listDocs, getDoc, createDoc, updateDoc, COLLECTIONS } from '../lib/store';
import { expireReservations, computeDueDate, MS_PER_DAY } from '../lib/overdue';
import { getSettings } from '../lib/settings';
import { parse, reservationQuerySchema } from '../validation';

export const reservationRouter = Router();

reservationRouter.use(requireAuth);

const RESERVATION_DAYS = 3;

const ACTIVE_STATUSES = ['ACTIVE', 'OVERDUE'];

async function listAllReservations(): Promise<any[]> {
  const res = await listDocs(COLLECTIONS.reservations, { pageSize: 1000 });
  return res.docs;
}

reservationRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    await expireReservations();
    const q = parse(reservationQuerySchema, req.query);
    const search = q.search?.toLowerCase();
    const resList = await listDocs(COLLECTIONS.reservations, {
      pageSize: 1000,
      orderBy: { attr: 'createdAt', direction: 'desc' },
    });

    let items = resList.docs.filter((r) => {
      if (q.status && q.status !== 'all' && r.status !== q.status) return false;
      if (q.readerId && r.readerId !== String(q.readerId)) return false;
      if (q.bookId && r.bookId !== String(q.bookId)) return false;
      return true;
    });

    if (search) {
      const readers = new Map<string, any>();
      const books = new Map<string, any>();
      items = items.filter((r) => {
        const readerName = readers.get(r.readerId)?.name;
        const bookTitle = books.get(r.bookId)?.title;
        return (
          (readerName && readerName.toLowerCase().includes(search)) ||
          (bookTitle && bookTitle.toLowerCase().includes(search))
        );
      });
    }

    items.sort((a, b) => {
      const statusOrder = ['PENDING', 'AVAILABLE', 'FULFILLED', 'CANCELLED', 'EXPIRED'];
      const aIdx = statusOrder.indexOf(a.status);
      const bIdx = statusOrder.indexOf(b.status);
      const byStatus = (aIdx < 0 ? 99 : aIdx) - (bIdx < 0 ? 99 : bIdx);
      if (byStatus !== 0) return byStatus;
      return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
    });

    const total = items.length;
    const start = (q.page - 1) * q.pageSize;
    items = items.slice(start, start + q.pageSize);

    const enriched = await Promise.all(
      items.map(async (r) => {
        const reader = await getDoc(COLLECTIONS.readers, r.readerId);
        const book = await getDoc(COLLECTIONS.books, r.bookId);
        return {
          ...r,
          reader: reader ? { id: reader.$id, name: reader.name, cpf: reader.cpf } : null,
          book: book ? { id: book.$id, title: book.title } : null,
        };
      }),
    );

    res.json({ items: enriched, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

reservationRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const readerId = String(body.readerId ?? '');
    const bookId = String(body.bookId ?? '');
    if (!readerId) throw new HttpError(400, 'readerId obrigatório');
    if (!bookId) throw new HttpError(400, 'bookId obrigatório');

    const reader = await getDoc(COLLECTIONS.readers, readerId);
    if (!reader) throw new HttpError(404, 'Leitor não encontrado');
    if (reader.deletedAt) throw new HttpError(400, 'Leitor excluído não pode reservar');
    if (reader.status !== 'ACTIVE') throw new HttpError(400, 'Leitor bloqueado não pode reservar');

    const book = await getDoc(COLLECTIONS.books, bookId);
    if (!book) throw new HttpError(404, 'Livro não encontrado');
    if (book.isArchived) throw new HttpError(400, 'Livro arquivado não pode ser reservado');

    const reservations = await listAllReservations();
    const pending = reservations.find(
      (r) =>
        r.readerId === readerId &&
        r.bookId === bookId &&
        ['PENDING', 'AVAILABLE'].includes(r.status),
    );
    if (pending) throw new HttpError(400, 'Leitor já possui reserva ativa para este livro');

    const reservation = await createDoc(COLLECTIONS.reservations, {
      readerId,
      bookId,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + RESERVATION_DAYS * MS_PER_DAY).toISOString(),
      fulfilledAt: null,
    });
    await writeAudit(req.user?.id, 'RESERVATION_CREATED', 'Reservation', reservation.$id, { readerId, bookId }, req.ip);
    res.status(201).json(reservation);
  }),
);

reservationRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await getDoc(COLLECTIONS.reservations, id);
    if (!existing) throw new HttpError(404, 'Reserva não encontrada');
    if (existing.status === 'FULFILLED') throw new HttpError(400, 'Reserva já atendida não pode ser cancelada');
    const reservation = await updateDoc(COLLECTIONS.reservations, id, { status: 'CANCELLED' });
    await writeAudit(req.user?.id, 'RESERVATION_CANCELLED', 'Reservation', id, undefined, req.ip);
    res.json(reservation);
  }),
);

reservationRouter.post(
  '/:id/fulfill',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const reservation = await getDoc(COLLECTIONS.reservations, id);
    if (!reservation) throw new HttpError(404, 'Reserva não encontrada');
    if (reservation.status === 'CANCELLED' || reservation.status === 'EXPIRED') {
      throw new HttpError(400, 'Reserva cancelada ou expirada não pode ser atendida');
    }
    if (reservation.status === 'FULFILLED') throw new HttpError(400, 'Reserva já atendida');

    const reader = await getDoc(COLLECTIONS.readers, reservation.readerId);
    if (!reader) throw new HttpError(404, 'Leitor não encontrado');
    if (reader.status !== 'ACTIVE') throw new HttpError(400, 'Leitor bloqueado não pode retirar reserva');

    const settings = await getSettings();
    const dueDate = computeDueDate(new Date(), settings.defaultLoanDays);

    const loans = await listDocs(COLLECTIONS.loans, { pageSize: 1000 });
    const activeBookLoan = loans.docs.find(
      (l) => l.bookId === reservation.bookId && ACTIVE_STATUSES.includes(l.status),
    );
    if (activeBookLoan) throw new HttpError(400, 'Este livro já está emprestado');

    const roster = loans.docs.filter(
      (l) => l.readerId === reservation.readerId && ACTIVE_STATUSES.includes(l.status),
    ).length;
    if (roster >= settings.loanLimit) {
      throw new HttpError(400, `Limite de empréstimos do leitor atingido (${settings.loanLimit})`);
    }

    const loanDate = new Date();
    const loan = await createDoc(COLLECTIONS.loans, {
      readerId: reservation.readerId,
      bookId: reservation.bookId,
      userId: req.user!.id,
      status: 'ACTIVE',
      dueDate: dueDate.toISOString(),
      loanDate: loanDate.toISOString(),
      returnedAt: null,
      renewals: 0,
      notes: null,
    });

    const number = `EMP-${String(loan.$id).padStart(6, '0')}`;
    await updateDoc(COLLECTIONS.loans, loan.$id, { number });

    await updateDoc(COLLECTIONS.reservations, id, {
      status: 'FULFILLED',
      fulfilledAt: new Date().toISOString(),
    });

    await writeAudit(req.user?.id, 'RESERVATION_FULFILLED', 'Reservation', id, { loanId: loan.$id }, req.ip);
    await writeAudit(req.user?.id, 'LOAN_CREATED', 'Loan', loan.$id, { number, viaReservation: id }, req.ip);
    res.status(201).json({ loanId: loan.$id, number });
  }),
);
