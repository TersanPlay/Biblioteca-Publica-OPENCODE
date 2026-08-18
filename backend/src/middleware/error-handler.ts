import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http-error';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join('.') || 'campo'}: ${i.message}`).join('; ');
    res.status(400).json({ error: message });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target: string[] = Array.isArray(err.meta?.target) ? err.meta.target : [];
      if (target.includes('isbn10') || target.includes('isbn13')) {
        res.status(409).json({ error: 'Este livro já está cadastrado.' });
        return;
      }
      res.status(409).json({ error: 'Registro duplicado: valor já cadastrado' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Registro não encontrado' });
      return;
    }
    if (err.code === 'P2003') {
      res.status(400).json({ error: 'Registro relacionado não encontrado' });
      return;
    }
  }
  if (err && typeof err === 'object' && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON inválido no corpo da requisição' });
    return;
  }
  console.error('[erro]', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
};