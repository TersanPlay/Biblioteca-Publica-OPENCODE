import cors from 'cors';
import express from 'express';
import { authRouter } from './modules/auth.routes';
import { userRouter } from './modules/user.routes';
import { bookRouter } from './modules/book.routes';
import { authorRouter } from './modules/author.routes';
import { categoryRouter } from './modules/category.routes';
import { knowledgeAreaRouter } from './modules/knowledge-area.routes';
import { readerRouter } from './modules/reader.routes';
import { loanRouter } from './modules/loan.routes';
import { reservationRouter } from './modules/reservation.routes';
import { reportRouter } from './modules/report.routes';
import { auditRouter } from './modules/audit.routes';
import { settingsRouter } from './modules/settings.routes';
import { dashboardRouter } from './modules/dashboard.routes';
import { backupRouter } from './modules/backup.routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

export const app = express();

app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim()),
  }),
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'livraria-api' });
});

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/books', bookRouter);
app.use('/api/authors', authorRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/knowledge-areas', knowledgeAreaRouter);
app.use('/api/readers', readerRouter);
app.use('/api/loans', loanRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/reports', reportRouter);
app.use('/api/audit', auditRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/backups', backupRouter);

app.use(notFoundHandler);
app.use(errorHandler);