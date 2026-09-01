import { Router } from 'express';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { loginLimiter } from '../middleware/login-rate-limit';
import { requireAuth, signToken } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { account } from '../lib/appwrite';
import { findDocBy, createDoc, COLLECTIONS } from '../lib/store';
import { loginSchema, parse } from '../validation';

export const authRouter = Router();

function publicUser(u: {
  id: string;
  name: string;
  email: string;
  role: string;
}): { id: string; name: string; email: string; role: 'ADMIN' | 'ATTENDANT' } {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as 'ADMIN' | 'ATTENDANT',
  };
}

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const data = parse(loginSchema, req.body);

    // Verifica credenciais no Appwrite Auth (identity + senha)
    let session;
    try {
      session = await account.createEmailPasswordSession({
        email: data.email,
        password: data.password,
      });
    } catch {
      await writeAudit(null, 'LOGIN_FAILED', 'User', undefined, { email: data.email }, req.ip);
      throw new HttpError(401, 'E-mail ou senha inválidos');
    }

    const appwriteUserId = session.userId;
    // Busca metadados (role/status) na collection users
    let user = await findDocBy(COLLECTIONS.users, 'appwriteUserId', appwriteUserId);
    if (!user) {
      // Primeiro acesso: autoprovê o admin criado no Appwrite Auth pelo seed
      const aw = await account.get();
      user = await createDoc(COLLECTIONS.users, {
        appwriteUserId,
        name: aw.name || data.email,
        email: data.email,
        role: 'ADMIN',
        status: 'ACTIVE',
      });
    }
    if (user.status !== 'ACTIVE') {
      throw new HttpError(403, 'Usuário inativo');
    }

    const token = signToken({ id: user.$id, role: user.role });
    await writeAudit(user.$id, 'LOGIN', 'User', user.$id, undefined, req.ip);
    res.json({ token, user: publicUser({ id: user.$id, name: user.name, email: user.email, role: user.role }) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    await writeAudit(req.user?.id, 'LOGOUT', 'User', req.user?.id, undefined, req.ip);
    res.json({ ok: true });
  }),
);
