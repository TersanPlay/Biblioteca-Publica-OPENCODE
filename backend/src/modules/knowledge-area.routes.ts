import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { listDocs, COLLECTIONS } from '../lib/store';

export const knowledgeAreaRouter = Router();

knowledgeAreaRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const resList = await listDocs(COLLECTIONS.knowledgeAreas, {
      pageSize: 1000,
      orderBy: { attr: 'name', direction: 'asc' },
    });
    const items = resList.docs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json({ items, total: items.length, page: 1, pageSize: items.length, totalPages: 1 });
  }),
);
