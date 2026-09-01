import { Router } from 'express';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { listDocs, createDoc, getDoc, updateDoc, COLLECTIONS } from '../lib/store';
import { subjectSchema, subjectStatusSchema, cleanNull, parse } from '../validation';

export const subjectRouter = Router();

export async function countBooksBySubject(subjectId: string): Promise<number> {
  const res = await listDocs(COLLECTIONS.books, { pageSize: 1000 });
  let n = 0;
  for (const b of res.docs) {
    if (Array.isArray(b.subjectIds) && b.subjectIds.includes(subjectId)) n++;
  }
  return n;
}

subjectRouter.get(
  '/',
  (req, res, next) => (req.query.all === '1' ? requireAuth(req, res, next) : next()),
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.all === '1' && !!req.user;
    const resList = await listDocs(COLLECTIONS.subjects, {
      pageSize: 1000,
      orderBy: { attr: 'name', direction: 'asc' },
    });
    let items = resList.docs.filter((c) => includeInactive || c.status === 'ACTIVE');
    items = items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const withCounts = await Promise.all(
      items.map(async (c) => ({ ...c, _count: { books: await countBooksBySubject(c.$id) } })),
    );
    res.json({ items: withCounts, total: items.length, page: 1, pageSize: items.length, totalPages: 1 });
  }),
);

subjectRouter.use(requireAuth, requireRoles('ADMIN'));

subjectRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(subjectSchema, req.body);
    const subject = await createDoc(COLLECTIONS.subjects, {
      name: data.name,
      description: cleanNull(data.description),
      status: 'ACTIVE',
    });
    await writeAudit(req.user?.id, 'SUBJECT_CREATED', 'Subject', subject.$id, { name: subject.name }, req.ip);
    res.status(201).json(subject);
  }),
);

subjectRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const data = parse(subjectSchema, req.body);
    const existing = await getDoc(COLLECTIONS.subjects, id);
    if (!existing) throw new HttpError(404, 'Assunto não encontrado');
    const subject = await updateDoc(COLLECTIONS.subjects, id, {
      name: data.name,
      description: cleanNull(data.description),
    });
    await writeAudit(req.user?.id, 'SUBJECT_UPDATED', 'Subject', id, { name: subject.name }, req.ip);
    res.json(subject);
  }),
);

subjectRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { status } = parse(subjectStatusSchema, req.body);
    const existing = await getDoc(COLLECTIONS.subjects, id);
    if (!existing) throw new HttpError(404, 'Assunto não encontrado');
    const subject = await updateDoc(COLLECTIONS.subjects, id, { status });
    await writeAudit(req.user?.id, 'SUBJECT_STATUS_CHANGED', 'Subject', id, { status }, req.ip);
    res.json(subject);
  }),
);
