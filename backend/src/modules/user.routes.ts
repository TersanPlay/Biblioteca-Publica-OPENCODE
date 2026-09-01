import { Router } from 'express';
import { users as awUsers, account as awAccount } from '../lib/appwrite';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import {
  findDocBy, listDocs, createDoc, getDoc, updateDoc, deleteDoc, COLLECTIONS,
} from '../lib/store';
import { parse, userCreateSchema, userQuerySchema, userUpdateSchema, resetPasswordSchema } from '../validation';

export const userRouter = Router();

userRouter.use(requireAuth, requireRoles('ADMIN'));

userRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(userQuerySchema, req.query);
    const search = q.search?.toLowerCase();
    const resList = await listDocs(COLLECTIONS.users, { pageSize: 1000, orderBy: { attr: 'name', direction: 'asc' } });
    let items = resList.docs.filter((u) => {
      if (q.search && !u.name?.toLowerCase().includes(search) && !u.email?.toLowerCase().includes(search)) return false;
      if (q.role && u.role !== q.role) return false;
      if (q.status && u.status !== q.status) return false;
      return true;
    });
    const total = items.length;
    const start = (q.page - 1) * q.pageSize;
    items = items.slice(start, start + q.pageSize);
    res.json({ items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

userRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(userCreateSchema, req.body);
    const exists = await findDocBy(COLLECTIONS.users, 'email', data.email);
    if (exists) throw new HttpError(409, 'E-mail já cadastrado');
    let awId = '';
    try {
      const aw = await awUsers.create(`user-${Date.now()}`, data.email, undefined, data.password, data.name);
      awId = aw.$id;
    } catch (err: any) {
      if (err?.type === 'user_already_exists') throw new HttpError(409, 'E-mail já cadastrado');
      throw new HttpError(500, 'Falha ao criar usuário no Appwrite');
    }
    const user = await createDoc(COLLECTIONS.users, {
      appwriteUserId: awId,
      name: data.name,
      email: data.email,
      role: data.role,
      status: 'ACTIVE',
    });
    await writeAudit(req.user?.id, 'USER_CREATED', 'User', user.$id, { email: user.email, role: user.role }, req.ip);
    res.status(201).json(user);
  }),
);

userRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const user = await getDoc(COLLECTIONS.users, id);
    if (!user) throw new HttpError(404, 'Usuário não encontrado');
    res.json(user);
  }),
);

userRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const data = parse(userUpdateSchema, req.body);
    const existing = await getDoc(COLLECTIONS.users, id);
    if (!existing) throw new HttpError(404, 'Usuário não encontrado');
    if (data.email && data.email !== existing.email) {
      const clash = await findDocBy(COLLECTIONS.users, 'email', data.email);
      if (clash && clash.$id !== id) throw new HttpError(409, 'E-mail já cadastrado');
    }
    if (data.role && data.role !== existing.role && existing.role === 'ADMIN' && req.user!.id !== id) {
      throw new HttpError(403, 'Não é possível alterar o papel de outro administrador');
    }
    const user = await updateDoc(COLLECTIONS.users, id, {
      name: data.name ?? existing.name,
      email: data.email ?? existing.email,
      role: data.role ?? existing.role,
      status: data.status ?? existing.status,
    });
    await writeAudit(req.user?.id, 'USER_UPDATED', 'User', id, { email: user.email, role: user.role }, req.ip);
    res.json(user);
  }),
);

userRouter.post(
  '/:id/password',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const data = parse(resetPasswordSchema, req.body);
    const existing = await getDoc(COLLECTIONS.users, id);
    if (!existing) throw new HttpError(404, 'Usuário não encontrado');
    if (existing.role === 'ADMIN' && req.user!.id !== id) {
      if (!data.currentPassword) throw new HttpError(400, 'Senha atual obrigatória para redefinir senha de outro administrador');
      // Verifica a senha atual no Appwrite Auth do chamador
      try {
        await awAccount.createEmailPasswordSession({
          email: req.user!.email,
          password: data.currentPassword,
        });
      } catch {
        throw new HttpError(403, 'Senha atual inválida');
      }
    }
    // Redefinir senha requer credencial/substituição no Appwrite Auth
    try {
      await awUsers.updatePassword(existing.appwriteUserId, data.password);
    } catch (err: any) {
      if (err?.type === 'user_not_found') throw new HttpError(404, 'Usuário não encontrado');
      throw new HttpError(err?.code === 401 ? 403 : 500, 'Não foi possível redefinir a senha');
    }
    await writeAudit(req.user?.id, 'USER_PASSWORD_RESET', 'User', id, undefined, req.ip);
    res.json({ ok: true });
  }),
);
