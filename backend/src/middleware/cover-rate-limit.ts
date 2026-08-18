import rateLimit from 'express-rate-limit';

export const coverLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas consultas de capa. Tente novamente mais tarde.' },
});
