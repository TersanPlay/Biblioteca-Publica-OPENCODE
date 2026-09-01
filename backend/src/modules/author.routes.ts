import { Router } from 'express';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { listDocs, createDoc, getDoc, updateDoc, COLLECTIONS } from '../lib/store';
import { authorSchema, authorStatusSchema, listQuerySchema, parse } from '../validation';

export const authorRouter = Router();

authorRouter.use(requireAuth);

export async function countBooksByAuthor(authorId: string): Promise<number> {
  const res = await listDocs(COLLECTIONS.books, { pageSize: 1000 });
  let n = 0;
  for (const b of res.docs) {
    if (Array.isArray(b.authorIds) && b.authorIds.includes(authorId)) n++;
  }
  return n;
}

async function withCount(a: any) {
  return { ...a, _count: { books: await countBooksByAuthor(a.$id) } };
}

authorRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(listQuerySchema, req.query);
    const all = req.query.all === '1';
    const search = q.search?.toLowerCase();
    const resList = await listDocs(COLLECTIONS.authors, {
      pageSize: all ? 1000 : q.pageSize,
      orderBy: { attr: 'name', direction: 'asc' },
    });
    let items = resList.docs
      .filter((a) => {
        if (q.search && !a.name?.toLowerCase().includes(search)) return false;
        if (q.status === 'active' && a.isActive !== true) return false;
        if (q.status === 'inactive' && a.isActive !== false) return false;
        if (all || q.status === 'active') return a.isActive !== false;
        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const total = items.length;
    if (!all) {
      const start = (q.page - 1) * q.pageSize;
      items = items.slice(start, start + q.pageSize);
    }
    const withCounts = await Promise.all(items.map(withCount));
    res.json({ items: withCounts, total, page: q.page, pageSize: all ? total : q.pageSize, totalPages: all ? 1 : Math.ceil(total / q.pageSize) });
  }),
);

authorRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(authorSchema, req.body);
    const author = await createDoc(COLLECTIONS.authors, { name: data.name, isActive: true });
    await writeAudit(req.user?.id, 'AUTHOR_CREATED', 'Author', author.$id, { name: author.name }, req.ip);
    res.status(201).json(author);
  }),
);

authorRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const data = parse(authorSchema, req.body);
    const existing = await getDoc(COLLECTIONS.authors, id);
    if (!existing) throw new HttpError(404, 'Autor não encontrado');
    const author = await updateDoc(COLLECTIONS.authors, id, {
      name: data.name,
      isActive: data.isActive ?? existing.isActive ?? true,
    });
    await writeAudit(req.user?.id, 'AUTHOR_UPDATED', 'Author', id, { name: author.name }, req.ip);
    res.json(author);
  }),
);

authorRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { isActive } = parse(authorStatusSchema, req.body);
    const existing = await getDoc(COLLECTIONS.authors, id);
    if (!existing) throw new HttpError(404, 'Autor não encontrado');
    const author = await updateDoc(COLLECTIONS.authors, id, { isActive });
    await writeAudit(req.user?.id, isActive ? 'AUTHOR_ACTIVATED' : 'AUTHOR_INACTIVATED', 'Author', id, undefined, req.ip);
    res.json(author);
  }),
);
