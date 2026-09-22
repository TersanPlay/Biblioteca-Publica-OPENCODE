import type { NextFunction, Request, Response } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { isFunctionRuntime } from '../lib/appwrite';

function noop(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

export const loginLimiter = (isFunctionRuntime()
  ? noop
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    })) as RateLimitRequestHandler;