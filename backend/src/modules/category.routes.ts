import { Router } from 'express';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { listDocs, createDoc, getDoc, updateDoc, COLLECTIONS } from '../lib/store';
import { categorySchema, categoryStatusSchema, cleanNull, parse } from '../validation';

export const categoryRouter = Router();

export async function countBooksByCategory(categoryId: string): Promise<number> {
  const res = await listDocs(COLLECTIONS.books, { pageSize: 1000 });
  let n = 0;
  for (const b of res.docs) {
    if (Array.isArray(b.categoryIds) && b.categoryIds.includes(categoryId)) n++;
  }
  return n;
}

categoryRouter.get(
  '/',
  (req, res, next) => (req.query.all === '1' ? requireAuth(req, res, next) : next()),
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.all === '1' && !!req.user;
    const resList = await listDocs(COLLECTIONS.categories, {
      pageSize: 1000,
      orderBy: { attr: 'name', direction: 'asc' },
    });
    let items = resList.docs.filter((c) => includeInactive || c.status === 'ACTIVE');
    items = items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const withCounts = await Promise.all(
      items.map(async (c) => ({ ...c, _count: { books: await countBooksByCategory(c.$id) } })),
    );
    res.json({ items: withCounts, total: items.length, page: 1, pageSize: items.length, totalPages: 1 });
  }),
);

categoryRouter.use(requireAuth, requireRoles('ADMIN'));

categoryRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(categorySchema, req.body);
    const category = await createDoc(COLLECTIONS.categories, {
      name: data.name,
      description: cleanNull(data.description),
      status: 'ACTIVE',
    });
    await writeAudit(req.user?.id, 'CATEGORY_CREATED', 'Category', category.$id, { name: category.name }, req.ip);
    res.status(201).json(category);
  }),
);

categoryRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const data = parse(categorySchema, req.body);
    const existing = await getDoc(COLLECTIONS.categories, id);
    if (!existing) throw new HttpError(404, 'Categoria não encontrada');
    const category = await updateDoc(COLLECTIONS.categories, id, {
      name: data.name,
      description: cleanNull(data.description),
    });
    await writeAudit(req.user?.id, 'CATEGORY_UPDATED', 'Category', id, { name: category.name }, req.ip);
    res.json(category);
  }),
);

categoryRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { status } = parse(categoryStatusSchema, req.body);
    const existing = await getDoc(COLLECTIONS.categories, id);
    if (!existing) throw new HttpError(404, 'Categoria não encontrada');
    const category = await updateDoc(COLLECTIONS.categories, id, { status });
    await writeAudit(req.user?.id, 'CATEGORY_STATUS_CHANGED', 'Category', id, { status }, req.ip);
    res.json(category);
  }),
);
