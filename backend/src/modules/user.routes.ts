import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { parse, userCreateSchema, userQuerySchema, userUpdateSchema, resetPasswordSchema } from '../validation';

export const userRouter = Router();

userRouter.use(requireAuth, requireRoles('ADMIN'));

userRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(userQuerySchema, req.query);
    const where = {
      ...(q.search ? { OR: [{ name: { contains: q.search } }, { email: { contains: q.search } }] } : {}),
      ...(q.role ? { role: q.role } : {}),
      ...(q.status ? { status: q.status } : {}),
    };
    const total = await prisma.user.count({ where });
    const items = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      orderBy: { name: 'asc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    res.json({ items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

userRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(userCreateSchema, req.body);
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw new HttpError(409, 'E-mail já cadastrado');
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: await bcrypt.hash(data.password, 10),
        role: data.role,
      },
    });
    await writeAudit(req.user?.id, 'USER_CREATED', 'User', user.id, { email: user.email, role: user.role }, req.ip);
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, status: user.status });
  }),
);

userRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new HttpError(404, 'Usuário não encontrado');
    res.json(user);
  }),
);

userRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = parse(userUpdateSchema, req.body);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Usuário não encontrado');
    if (data.email && data.email !== existing.email) {
      const clash = await prisma.user.findUnique({ where: { email: data.email } });
      if (clash) throw new HttpError(409, 'E-mail já cadastrado');
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        email: data.email ?? existing.email,
        role: data.role ?? existing.role,
        status: data.status ?? existing.status,
      },
    });
    await writeAudit(req.user?.id, 'USER_UPDATED', 'User', id, { email: user.email, role: user.role }, req.ip);
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, status: user.status });
  }),
);

userRouter.post(
  '/:id/password',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = parse(resetPasswordSchema, req.body);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Usuário não encontrado');
    await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(data.password, 10) } });
    await writeAudit(req.user?.id, 'USER_PASSWORD_RESET', 'User', id, undefined, req.ip);
    res.json({ ok: true });
  }),
);