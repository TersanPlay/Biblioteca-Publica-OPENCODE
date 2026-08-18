import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import prisma from '../lib/prisma';
import { HttpError } from '../lib/http-error';
import { asyncHandler } from '../middleware/async-handler';
import { loginLimiter } from '../middleware/login-rate-limit';
import { requireAuth, signToken } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { loginSchema, parse } from '../validation';

export const authRouter = Router();

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

function publicUser(u: {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}): { id: number; name: string; email: string; role: 'ADMIN' | 'ATTENDANT'; status: string } {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as 'ADMIN' | 'ATTENDANT',
    status: u.status,
  };
}

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const data = parse(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    const valid = await bcrypt.compare(data.password, user ? user.passwordHash : DUMMY_PASSWORD_HASH);
    if (!user || !valid || user.status !== 'ACTIVE') {
      await writeAudit(null, 'LOGIN_FAILED', 'User', user?.id, { email: data.email }, req.ip);
      throw new HttpError(401, 'E-mail ou senha inválidos');
    }
    const token = signToken(user);
    await writeAudit(user.id, 'LOGIN', 'User', user.id, undefined, req.ip);
    res.json({ token, user: publicUser(user) });
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