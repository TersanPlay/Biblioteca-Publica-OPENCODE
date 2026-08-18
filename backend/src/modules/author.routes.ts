import { Router } from 'express';
import prisma from '../lib/prisma';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { authorSchema, authorStatusSchema, listQuerySchema, parse } from '../validation';

export const authorRouter = Router();

authorRouter.use(requireAuth);

authorRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(listQuerySchema, req.query);
    const all = req.query.all === '1';
    const where = {
      ...(q.search ? { name: { contains: q.search } } : {}),
      ...(q.status === 'active' ? { isActive: true } : {}),
      ...(q.status === 'inactive' ? { isActive: false } : {}),
    };
    if (all) {
      const items = await prisma.author.findMany({
        where: { isActive: true, ...(q.search ? { name: { contains: q.search } } : {}) },
        include: { _count: { select: { books: true } } },
        orderBy: { name: 'asc' },
      });
      res.json({ items, total: items.length, page: 1, pageSize: items.length, totalPages: 1 });
      return;
    }
    const total = await prisma.author.count({ where });
    const items = await prisma.author.findMany({
      where,
      include: { _count: { select: { books: true } } },
      orderBy: { name: 'asc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    res.json({ items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

authorRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(authorSchema, req.body);
    const author = await prisma.author.create({
      data: { name: data.name },
    });
    await writeAudit(req.user?.id, 'AUTHOR_CREATED', 'Author', author.id, { name: author.name }, req.ip);
    res.status(201).json(author);
  }),
);

authorRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = parse(authorSchema, req.body);
    const existing = await prisma.author.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Autor não encontrado');
    const author = await prisma.author.update({
      where: { id },
      data: { name: data.name, isActive: data.isActive ?? existing.isActive },
    });
    await writeAudit(req.user?.id, 'AUTHOR_UPDATED', 'Author', id, { name: author.name }, req.ip);
    res.json(author);
  }),
);

authorRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { isActive } = parse(authorStatusSchema, req.body);
    const existing = await prisma.author.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Autor não encontrado');
    const author = await prisma.author.update({ where: { id }, data: { isActive } });
    await writeAudit(req.user?.id, isActive ? 'AUTHOR_ACTIVATED' : 'AUTHOR_INACTIVATED', 'Author', id, undefined, req.ip);
    res.json(author);
  }),
);