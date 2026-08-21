import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { HttpError } from '../lib/http-error';

export const backupRouter = Router();

const BACKUP_DIR = path.resolve(__dirname, '../../backups');
const DB_PATH = path.resolve(__dirname, '../../prisma/dev.db');
const MAX_BACKUPS = 5;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

export async function createBackup(): Promise<{ filename: string; size: number }> {
  ensureBackupDir();
  const filename = `backup_${timestamp()}.sqlite`;
  const dest = path.join(BACKUP_DIR, filename);

  await prisma.$executeRawUnsafe(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);

  const stats = fs.statSync(dest);
  rotateBackups();
  return { filename, size: stats.size };
}

function rotateBackups() {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('backup_') && f.endsWith('.sqlite'))
    .sort()
    .reverse();

  for (const file of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(BACKUP_DIR, file));
  }
}

function listBackups(): { filename: string; size: number; createdAt: string }[] {
  ensureBackupDir();
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('backup_') && f.endsWith('.sqlite'))
    .sort()
    .reverse()
    .map((filename) => {
      const stats = fs.statSync(path.join(BACKUP_DIR, filename));
      return {
        filename,
        size: stats.size,
        createdAt: stats.mtime.toISOString(),
      };
    });
}

backupRouter.get(
  '/',
  requireAuth,
  requireRoles('ADMIN'),
  asyncHandler(async (_req, res) => {
    res.json(listBackups());
  }),
);

backupRouter.post(
  '/',
  requireAuth,
  requireRoles('ADMIN'),
  asyncHandler(async (_req, res) => {
    const result = await createBackup();
    res.status(201).json(result);
  }),
);

backupRouter.post(
  '/:filename/restore',
  requireAuth,
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const { filename } = req.params;
    if (!/^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.sqlite$/.test(filename)) {
      throw new HttpError(400, 'Nome de arquivo inválido');
    }

    const src = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(src)) {
      throw new HttpError(404, 'Backup não encontrado');
    }

    fs.copyFileSync(src, DB_PATH);

    const journalPath = DB_PATH + '-journal';
    if (fs.existsSync(journalPath)) fs.unlinkSync(journalPath);
    const walPath = DB_PATH + '-wal';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);

    res.json({ ok: true, message: `Banco restaurado a partir de ${filename}` });
  }),
);

backupRouter.delete(
  '/:filename',
  requireAuth,
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const { filename } = req.params;
    if (!/^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.sqlite$/.test(filename)) {
      throw new HttpError(400, 'Nome de arquivo inválido');
    }

    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new HttpError(404, 'Backup não encontrado');
    }

    fs.unlinkSync(filePath);
    res.json({ ok: true });
  }),
);

export function startBackupCrons() {
  cron.schedule('30 18 * * *', async () => {
    console.log('[cron] Backup automático das 18:30...');
    try {
      const result = await createBackup();
      console.log(`[cron] Backup criado: ${result.filename} (${result.size} bytes)`);
    } catch (err) {
      console.error('[cron] Erro no backup automático:', err);
    }
  });

  cron.schedule('45 23 * * *', async () => {
    console.log('[cron] Backup automático das 23:45...');
    try {
      const result = await createBackup();
      console.log(`[cron] Backup criado: ${result.filename} (${result.size} bytes)`);
    } catch (err) {
      console.error('[cron] Erro no backup automático:', err);
    }
  });

  console.log('[cron] Backups agendados: 18:30 e 23:45');
}
