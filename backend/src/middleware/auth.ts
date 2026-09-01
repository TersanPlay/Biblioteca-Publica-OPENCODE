import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { HttpError } from '../lib/http-error';
import { getDoc, COLLECTIONS } from '../lib/store';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'ATTENDANT';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function jwtSecret(): string {
  return process.env.JWT_SECRET!;
}

export function signToken(user: { id: string; role: string }): string {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES || '8h') as jwt.SignOptions['expiresIn'],
  });
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Não autenticado');
    let payload: { sub: string };
    try {
      payload = jwt.verify(token, jwtSecret()) as unknown as { sub: string };
    } catch {
      throw new HttpError(401, 'Sessão expirada');
    }
    // O sub do JWT é o $id do doc do usuário na collection users
    const user = await getDoc(COLLECTIONS.users, payload.sub);
    if (!user || user.status !== 'ACTIVE') throw new HttpError(401, 'Sessão inválida');
    req.user = {
      id: user.$id,
      name: user.name,
      email: user.email,
      role: user.role as 'ADMIN' | 'ATTENDANT',
    };
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRoles =
  (...roles: Array<'ADMIN' | 'ATTENDANT'>): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new HttpError(403, 'Sem permissão para esta operação'));
      return;
    }
    next();
  };
