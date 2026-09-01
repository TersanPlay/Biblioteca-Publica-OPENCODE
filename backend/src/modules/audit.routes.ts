import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { auditQuerySchema, dateOrNull, parse } from '../validation';
import { listDocs, getDoc, COLLECTIONS } from '../lib/store';

export const auditRouter = Router();

auditRouter.use(requireAuth, requireRoles('ADMIN'));

auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(auditQuerySchema, req.query);
    const start = dateOrNull(q.start);
    const end = dateOrNull(q.end);
    const endInclusive = end ? new Date(end.getTime() + 86399999) : undefined;

    const allRes = await listDocs(COLLECTIONS.auditLogs, {
      pageSize: 1000,
      orderBy: { attr: 'createdAt', direction: 'desc' },
    });
    let items = allRes.docs;
    if (q.action) items = items.filter((a) => a.action === q.action);
    if (q.userId) items = items.filter((a) => String(a.userId) === String(q.userId));
    if (start) {
      const s = start.toISOString();
      items = items.filter((a) => a.$createdAt >= s);
    }
    if (endInclusive) {
      const e = endInclusive.toISOString();
      items = items.filter((a) => a.$createdAt <= e);
    }
    const total = items.length;
    const startIdx = (q.page - 1) * q.pageSize;
    const paged = items.slice(startIdx, startIdx + q.pageSize);

    const userIds = [...new Set(paged.map((a) => a.userId).filter((id): id is string => !!id))];
    const userMap: Record<string, { name: string; email: string }> = {};
    for (const uid of userIds) {
      const user = await getDoc(COLLECTIONS.users, uid);
      if (user) userMap[uid] = { name: user.name, email: user.email };
    }
    const enriched = paged.map((a) => ({
      ...a,
      userName: a.userId ? userMap[a.userId]?.name ?? null : null,
      userEmail: a.userId ? userMap[a.userId]?.email ?? null : null,
    }));

    res.json({ items: enriched, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

auditRouter.get(
  '/actions',
  asyncHandler(async (_req, res) => {
    const allRes = await listDocs(COLLECTIONS.auditLogs, { pageSize: 1000 });
    const actionSet = new Set<string>();
    for (const log of allRes.docs) {
      if (log.action) actionSet.add(log.action);
    }
    res.json({ actions: [...actionSet] });
  }),
);
