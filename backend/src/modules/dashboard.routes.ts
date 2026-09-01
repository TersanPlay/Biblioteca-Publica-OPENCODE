import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { refreshOverdue, MS_PER_DAY } from '../lib/overdue';
import { listDocs, COLLECTIONS } from '../lib/store';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    await refreshOverdue();

    const [
      booksRes,
      loansRes,
      readersRes,
    ] = await Promise.all([
      listDocs(COLLECTIONS.books, { pageSize: 1000 }),
      listDocs(COLLECTIONS.loans, { pageSize: 1000 }),
      listDocs(COLLECTIONS.readers, { pageSize: 1000 }),
    ]);

    const totalBooks = booksRes.docs.filter((b) => !b.isArchived).length;
    const activeLoans = loansRes.docs.filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE').length;
    const overdueLoans = loansRes.docs.filter((l) => l.status === 'OVERDUE').length;
    const activeReaders = readersRes.docs.filter((r) => r.status === 'ACTIVE' && !r.deletedAt).length;
    const availableBooks = Math.max(0, totalBooks - activeLoans);

    const recentLoans = loansRes.docs
      .filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE')
      .sort((a, b) => (b.$createdAt ?? '').localeCompare(a.$createdAt ?? ''))
      .slice(0, 5);

    const recentReturns = loansRes.docs
      .filter((l) => l.status === 'RETURNED')
      .sort((a, b) => (b.returnedAt ?? '').localeCompare(a.returnedAt ?? ''))
      .slice(0, 5);

    const overdue = loansRes.docs
      .filter((l) => l.status === 'OVERDUE')
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
      .slice(0, 5);

    const cutoff = new Date(Date.now() - 30 * MS_PER_DAY).toISOString();
    const recentLoanDocs = loansRes.docs.filter((l) => l.loanDate && l.loanDate >= cutoff);
    const countByBook = new Map<string, number>();
    for (const l of recentLoanDocs) {
      if (!l.bookId) continue;
      countByBook.set(l.bookId, (countByBook.get(l.bookId) ?? 0) + 1);
    }
    const topBooksRaw = [...countByBook.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topBooks = topBooksRaw.map(([bookId, count]) => ({
      title: recentLoanDocs.find((l) => l.bookId === bookId)?.bookTitleSnapshot ?? `Livro`,
      count,
    }));

    res.json({
      totalBooks,
      availableBooks,
      loanedBooks: activeLoans,
      activeReaders,
      activeLoans,
      overdueLoans,
      recentLoans,
      recentReturns,
      overdue,
      topBooks,
    });
  }),
);
