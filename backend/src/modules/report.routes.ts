import { Router } from 'express';
import type { Request } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { dateOrNull, parse, reportQuerySchema } from '../validation';
import { refreshOverdue, MS_PER_DAY } from '../lib/overdue';
import { listDocs, getDoc, COLLECTIONS } from '../lib/store';

export const reportRouter = Router();

reportRouter.use(requireAuth, requireRoles('ADMIN'));

type Row = (string | number | null | undefined)[];

interface ReportResult {
  type: string;
  generatedAt: string;
  filters: Record<string, unknown>;
  columns: string[];
  rows: Row[];
}

function buildResult(type: string, req: Request, columns: string[], rows: Row[]): ReportResult {
  const filters: Record<string, unknown> = {};
  for (const key of ['start', 'end', 'categoryId', 'bookId', 'readerId', 'limit']) {
    const v = (req.query as Record<string, unknown>)[key];
    if (v) filters[key] = v;
  }
  return { type, generatedAt: new Date().toISOString(), filters, columns, rows };
}

function toCsv(columns: string[], rows: Row[]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(';'), ...rows.map((r) => r.map(esc).join(';'))].join('\r\n');
}

function dayStart(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

function dayEndInclusive(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, -1).toISOString();
}

async function computeReport(req: Request): Promise<ReportResult> {
  const q = parse(reportQuerySchema, req.query);
  const start = dateOrNull(q.start);
  const end = dateOrNull(q.end);
  await refreshOverdue();

  const periodStart = start ? dayStart(start) : undefined;
  const periodEnd = end ? dayEndInclusive(end) : undefined;

  let columns: string[];
  let rows: Row[];

  if (q.type === 'acervo') {
    const [allBooks, allLoans, categoriesRes, authorsRes] = await Promise.all([
      listDocs(COLLECTIONS.books, { pageSize: 1000 }),
      listDocs(COLLECTIONS.loans, { pageSize: 1000 }),
      listDocs(COLLECTIONS.categories, { pageSize: 1000 }),
      listDocs(COLLECTIONS.authors, { pageSize: 1000 }),
    ]);
    const totalBooks = allBooks.docs.filter((b) => !b.isArchived).length;
    const archivedBooks = allBooks.docs.filter((b) => b.isArchived).length;
    const activeLoans = allLoans.docs.filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE').length;
    columns = ['Métrica', 'Valor'];
    rows = [
      ['Livros cadastrados', totalBooks],
      ['Livros arquivados', archivedBooks],
      ['Livros disponíveis', Math.max(0, totalBooks - activeLoans)],
      ['Livros emprestados', activeLoans],
      ['Categorias', categoriesRes.total],
      ['Autores', authorsRes.total],
    ];
  } else if (q.type === 'available' || q.type === 'loaned') {
    const loansRes = await listDocs(COLLECTIONS.loans, { pageSize: 1000 });
    const loanedBookIds = new Set(
      loansRes.docs
        .filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE')
        .map((l) => l.bookId),
    );
    const bookOpts: Parameters<typeof listDocs>[1] = { pageSize: 1000, orderBy: { attr: 'title', direction: 'asc' } };
    const booksRes = await listDocs(COLLECTIONS.books, bookOpts);
    let items = booksRes.docs
      .filter((b) => !b.isArchived)
      .filter((b) => {
        if (q.categoryId && !b.categoryIds?.includes(String(q.categoryId))) return false;
        if (q.bookId && b.$id !== String(q.bookId)) return false;
        if (q.type === 'available') return !loanedBookIds.has(b.$id);
        return loanedBookIds.has(b.$id);
      })
      .slice(0, q.limit);
    columns = ['Título', 'ISBN'];
    rows = items.map((b) => [b.title, b.isbn13 ?? b.isbn10]);
  } else if (q.type === 'overdue') {
    const loansRes = await listDocs(COLLECTIONS.loans, {
      pageSize: 1000,
      orderBy: { attr: 'dueDate', direction: 'asc' },
    });
    let items = loansRes.docs.filter((l) => l.status === 'OVERDUE');
    if (q.readerId) items = items.filter((l) => l.readerId === String(q.readerId));
    items = items.slice(0, q.limit);
    columns = ['Leitor', 'Livro', 'Devido em'];
    rows = items.map((l) => [
      l.readerNameSnapshot ?? `Leitor`,
      l.bookTitleSnapshot ?? `Livro`,
      l.dueDate?.slice(0, 10),
    ]);
  } else if (q.type === 'loans-period' || q.type === 'returns-period') {
    const isReturn = q.type === 'returns-period';
    const loansRes = await listDocs(COLLECTIONS.loans, { pageSize: 1000 });
    let items = loansRes.docs.filter((l) => {
      const dateField = isReturn ? l.returnedAt : l.loanDate;
      if (!dateField) return false;
      if (periodStart && dateField < periodStart) return false;
      if (periodEnd && dateField > periodEnd) return false;
      if (q.readerId && l.readerId !== String(q.readerId)) return false;
      return true;
    });
    items = items.slice(0, q.limit);
    columns = ['Leitor', 'Livro', isReturn ? 'Devolvido em' : 'Emprestado em'];
    rows = items.map((l) => [
      l.readerNameSnapshot ?? `Leitor`,
      l.bookTitleSnapshot ?? `Livro`,
      (isReturn ? l.returnedAt : l.loanDate)?.slice(0, 10),
    ]);
  } else if (q.type === 'active-readers') {
    const loansRes = await listDocs(COLLECTIONS.loans, { pageSize: 1000 });
    let filteredLoans = loansRes.docs;
    if (periodStart) filteredLoans = filteredLoans.filter((l) => l.loanDate >= periodStart);
    if (periodEnd) filteredLoans = filteredLoans.filter((l) => l.loanDate <= periodEnd);
    const countByReader = new Map<string, number>();
    for (const l of filteredLoans) {
      if (!l.readerId) continue;
      countByReader.set(l.readerId, (countByReader.get(l.readerId) ?? 0) + 1);
    }
    const sorted = [...countByReader.entries()].sort((a, b) => b[1] - a[1]).slice(0, q.limit);
    const readerIds = sorted.map(([id]) => id);
    const readerDocs = await Promise.all(readerIds.map((id) => getDoc(COLLECTIONS.readers, id)));
    const readerMap = new Map(readerDocs.filter(Boolean).map((r) => [r!.$id, r!]));
    columns = ['Leitor', 'CPF', 'Empréstimos no período'];
    rows = sorted.map(([readerId, count]) => [
      readerMap.get(readerId)?.name ?? `Leitor`,
      readerMap.get(readerId)?.cpf ?? '-',
      count,
    ]);
  } else if (q.type === 'top-books') {
    const loansRes = await listDocs(COLLECTIONS.loans, { pageSize: 1000 });
    let filteredLoans = loansRes.docs;
    if (periodStart) filteredLoans = filteredLoans.filter((l) => l.loanDate >= periodStart);
    if (periodEnd) filteredLoans = filteredLoans.filter((l) => l.loanDate <= periodEnd);
    const byBook = new Map<string, { title: string; isbn: string | null; count: number }>();
    for (const l of filteredLoans) {
      if (!l.bookId) continue;
      const current = byBook.get(l.bookId) ?? { title: l.bookTitleSnapshot ?? `Livro`, isbn: l.bookIsbnSnapshot ?? null, count: 0 };
      current.count += 1;
      byBook.set(l.bookId, current);
    }
    const top = [...byBook.values()].sort((a, b) => b.count - a.count).slice(0, q.limit);
    columns = ['Livro', 'ISBN', 'Empréstimos'];
    rows = top.map((r) => [r.title, r.isbn, r.count]);
  } else {
    const loansRes = await listDocs(COLLECTIONS.loans, { pageSize: 1000 });
    let filteredLoans = loansRes.docs;
    if (periodStart) filteredLoans = filteredLoans.filter((l) => l.loanDate >= periodStart);
    if (periodEnd) filteredLoans = filteredLoans.filter((l) => l.loanDate <= periodEnd);
    if (q.readerId) filteredLoans = filteredLoans.filter((l) => l.readerId === String(q.readerId));
    const categoriesRes = await listDocs(COLLECTIONS.categories, { pageSize: 1000 });
    const categoryMap = new Map(categoriesRes.docs.map((c) => [c.$id, c.name as string]));
    const byCategory = new Map<string, number>();
    const bookIds = [...new Set(filteredLoans.map((l) => l.bookId).filter(Boolean))];
    const bookDocs = await Promise.all(bookIds.map((id) => getDoc(COLLECTIONS.books, id as string)));
    const bookMap = new Map(bookDocs.filter(Boolean).map((b) => [b!.$id, b!]));
    for (const l of filteredLoans) {
      const book = l.bookId ? bookMap.get(l.bookId as string) : null;
      const categoryIds: string[] = book?.categoryIds ?? [];
      const names = categoryIds.map((id) => categoryMap.get(id) ?? 'Sem categoria');
      if (names.length === 0) {
        byCategory.set('Sem categoria', (byCategory.get('Sem categoria') ?? 0) + 1);
      } else {
        for (const name of names) {
          byCategory.set(name, (byCategory.get(name) ?? 0) + 1);
        }
      }
    }
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, q.limit);
    columns = ['Categoria', 'Empréstimos'];
    rows = top.map((r) => [r[0], r[1]]);
  }

  return buildResult(q.type, req, columns, rows);
}

reportRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await computeReport(req));
  }),
);

reportRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    const result = await computeReport(req);
    const csv = toCsv(result.columns, result.rows);
    const type = String((req.query as Record<string, unknown>).type || 'relatorio');
    const name = `relatorio-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send('\uFEFF' + csv);
  }),
);
