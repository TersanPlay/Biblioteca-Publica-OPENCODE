import { Router } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { loanInclude } from './loan.routes';
import { refreshOverdue } from '../lib/overdue';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

dashboardRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    await refreshOverdue();

    const [
      totalBooks,
      activeLoans,
      overdueLoans,
      activeReaders,
      recentLoans,
      recentReturns,
      overdue,
    ] = await Promise.all([
      prisma.book.count({ where: { isArchived: false } }),
      prisma.loan.count({ where: { status: { in: ['ACTIVE', 'OVERDUE'] } } }),
      prisma.loan.count({ where: { status: 'OVERDUE' } }),
      prisma.reader.count({ where: { status: 'ACTIVE' } }),
      prisma.loan.findMany({
        where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
        include: loanInclude,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.loan.findMany({
        where: { status: 'RETURNED' },
        include: loanInclude,
        orderBy: { returnedAt: 'desc' },
        take: 5,
      }),
      prisma.loan.findMany({
        where: { status: 'OVERDUE' },
        include: loanInclude,
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
    ]);

    const availableBooks = Math.max(0, totalBooks - activeLoans);
    const loans30 = await prisma.loan.findMany({
      where: { loanDate: { gte: new Date(Date.now() - 30 * 86400000) } },
      select: { book: { select: { id: true, title: true } } },
    });
    const byBook = new Map<number, { title: string; count: number }>();
    for (const l of loans30) {
      const b = l.book;
      const current = byBook.get(b.id) ?? { title: b.title, count: 0 };
      current.count += 1;
      byBook.set(b.id, current);
    }
    const topBooks = [...byBook.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    res.json({
      totalBooks,
      availableBooks,
      loanedBooks: activeLoans,
      activeReaders,
      activeLoans,
      overdueLoans,
      recentLoans: recentLoans.map((l) => ({
        ...l,
        loanDate: iso(l.loanDate),
        dueDate: iso(l.dueDate),
        returnedAt: iso(l.returnedAt),
        createdAt: iso(l.createdAt),
        updatedAt: iso(l.updatedAt),
      })),
      recentReturns: recentReturns.map((l) => ({
        ...l,
        loanDate: iso(l.loanDate),
        dueDate: iso(l.dueDate),
        returnedAt: iso(l.returnedAt),
        createdAt: iso(l.createdAt),
        updatedAt: iso(l.updatedAt),
      })),
      overdue: overdue.map((l) => ({
        ...l,
        loanDate: iso(l.loanDate),
        dueDate: iso(l.dueDate),
        returnedAt: iso(l.returnedAt),
        createdAt: iso(l.createdAt),
        updatedAt: iso(l.updatedAt),
      })),
      topBooks,
    });
  }),
);