import { Router } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { auditQuerySchema, dateOrNull, parse } from '../validation';

export const auditRouter = Router();

auditRouter.use(requireAuth, requireRoles('ADMIN'));

auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(auditQuerySchema, req.query);
    const start = dateOrNull(q.start);
    const end = dateOrNull(q.end);
    const endInclusive = end ? new Date(end.getTime() + 86399999) : undefined;
    const where = {
      ...(q.action ? { action: q.action } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(start || endInclusive
        ? { createdAt: { ...(start ? { gte: start } : {}), ...(endInclusive ? { lte: endInclusive } : {}) } }
        : {}),
    };
    const total = await prisma.auditLog.count({ where });
    const items = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    res.json({ items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

auditRouter.get(
  '/actions',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.auditLog.groupBy({ by: ['action'], _count: { _all: true } });
    res.json({ actions: rows.map((r) => r.action) });
  }),
);