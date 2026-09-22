import type { NextFunction, Request, Response } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { isFunctionRuntime } from '../lib/appwrite';

function noop(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

export const coverLimiter = (isFunctionRuntime()
  ? noop
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Muitas consultas de capa. Tente novamente mais tarde.' },
    })) as RateLimitRequestHandler;