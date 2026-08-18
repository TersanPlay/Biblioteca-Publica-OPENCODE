import { Router } from 'express';
import prisma from '../lib/prisma';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { categorySchema, categoryStatusSchema, cleanNull, parse } from '../validation';

export const categoryRouter = Router();

categoryRouter.get(
  '/',
  (req, res, next) => (req.query.all === '1' ? requireAuth(req, res, next) : next()),
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.all === '1' && !!req.user;
const items = await prisma.category.findMany({
      where: includeInactive ? {} : { status: 'ACTIVE' },
      include: { _count: { select: { bookLinks: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({
      items: items.map((c) => ({ ...c, _count: { books: c._count.bookLinks } })),
      total: items.length,
      page: 1,
      pageSize: items.length,
      totalPages: 1,
    });
  }),
);

categoryRouter.use(requireAuth, requireRoles('ADMIN'));

categoryRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(categorySchema, req.body);
    const category = await prisma.category.create({
      data: { name: data.name, description: cleanNull(data.description) },
    });
    await writeAudit(req.user?.id, 'CATEGORY_CREATED', 'Category', category.id, { name: category.name }, req.ip);
    res.status(201).json(category);
  }),
);

categoryRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = parse(categorySchema, req.body);
    const existing = await prisma.category.findUnique({ where: { id } });
if (!existing) throw new HttpError(404, 'Categoria não encontrada');
    const category = await prisma.category.update({
      where: { id },
      data: { name: data.name, description: cleanNull(data.description) },
    });
    await writeAudit(req.user?.id, 'CATEGORY_UPDATED', 'Category', id, { name: category.name }, req.ip);
    res.json(category);
  }),
);

categoryRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { status } = parse(categoryStatusSchema, req.body);
    const existing = await prisma.category.findUnique({ where: { id } });
if (!existing) throw new HttpError(404, 'Categoria não encontrada');
    const category = await prisma.category.update({ where: { id }, data: { status } });
    await writeAudit(req.user?.id, 'CATEGORY_STATUS_CHANGED', 'Category', id, { status }, req.ip);
    res.json(category);
  }),
);
