import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppwriteException } from 'node-appwrite';
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
  if (err instanceof AppwriteException) {
    if (err.type === 'document_already_exists' || err.type === 'user_already_exists') {
      res.status(409).json({ error: 'Registro duplicado: valor já cadastrado' });
      return;
    }
    if (err.type === 'user_not_found' || err.type === 'document_not_found') {
      res.status(404).json({ error: 'Registro não encontrado' });
      return;
    }
    if (err.code === 401) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    if (err.code === 403) {
      res.status(403).json({ error: 'Operação não autorizada' });
      return;
    }
    console.error('[appwrite]', err);
    res.status(500).json({ error: 'Erro no serviço de dados' });
    return;
  }
  if (err && typeof err === 'object' && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON inválido no corpo da requisição' });
    return;
  }
  console.error('[erro]', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
};