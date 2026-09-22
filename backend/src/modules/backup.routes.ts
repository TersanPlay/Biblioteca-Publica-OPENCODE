import { Router } from 'express';
import cron from 'node-cron';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth, requireRoles } from '../middleware/auth';
import { HttpError } from '../lib/http-error';
import { writeAudit } from '../lib/audit';
import { listDocs, COLLECTIONS } from '../lib/store';
import {
  ID,
  Query,
  storage,
  APPWRITE_BACKUP_BUCKET_ID,
  isFunctionRuntime,
} from '../lib/appwrite';
import { InputFile } from 'node-appwrite/file';

export const backupRouter = Router();

const MAX_BACKUPS = 5;
const COLLECTION_IDS = Object.values(COLLECTIONS);

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

function ensureBucketId(): string {
  if (!APPWRITE_BACKUP_BUCKET_ID) {
    throw new HttpError(500, 'Bucket de backup não configurado (APPWRITE_BACKUP_BUCKET_ID)');
  }
  return APPWRITE_BACKUP_BUCKET_ID;
}

export async function createBackup(): Promise<{ filename: string; size: number }> {
  const bucketId = ensureBucketId();
  const filename = `backup_${timestamp()}.json`;

  const collections: Record<string, unknown[]> = {};
  for (const collection of COLLECTION_IDS) {
    const { docs } = await listDocs(collection, { pageSize: 1000 });
    collections[collection] = docs;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    source: 'appwrite',
    collections,
  };

  const file = InputFile.fromBuffer(
    Buffer.from(JSON.stringify(payload, null, 2), 'utf-8'),
    filename,
  );
  const created = await storage.createFile({
    bucketId,
    fileId: filename,
    file,
    permissions: [], // acesso apenas via API key/server
  });

  await rotateBackups();
  await writeAudit(null, 'BACKUP_CREATED', 'Backup', filename, { size: created.sizeOriginal });
  return { filename, size: created.sizeOriginal };
}

async function rotateBackups(): Promise<void> {
  const bucketId = ensureBucketId();
  const { files } = await storage.listFiles({
    bucketId,
    queries: [Query.orderDesc('$createdAt')],
  });

  const backups = files.filter((f) => f.name.startsWith('backup_') && f.name.endsWith('.json'));
  for (const file of backups.slice(MAX_BACKUPS)) {
    await storage.deleteFile({ bucketId, fileId: file.$id });
  }
}

async function listBackups(): Promise<{ filename: string; size: number; createdAt: string }[]> {
  const bucketId = ensureBucketId();
  const { files } = await storage.listFiles({
    bucketId,
    queries: [Query.orderDesc('$createdAt')],
  });

  return files
    .filter((f) => f.name.startsWith('backup_') && f.name.endsWith('.json'))
    .map((f) => ({
      filename: f.name,
      size: f.sizeOriginal,
      createdAt: f.$createdAt,
    }));
}

backupRouter.get(
  '/',
  requireAuth,
  requireRoles('ADMIN'),
  asyncHandler(async (_req, res) => {
    res.json(await listBackups());
  }),
);

backupRouter.post(
  '/',
  requireAuth,
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const result = await createBackup();
    await writeAudit(req.user?.id, 'BACKUP_CREATED', 'Backup', result.filename, {
      size: result.size,
    });
    res.status(201).json(result);
  }),
);

const SAFE_FILENAME = /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.json$/;

backupRouter.get(
  '/:filename/download',
  requireAuth,
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const { filename } = req.params;
    if (!SAFE_FILENAME.test(filename)) {
      throw new HttpError(400, 'Nome de arquivo inválido');
    }
    const bucketId = ensureBucketId();

    let blob: ArrayBuffer;
    try {
      blob = await storage.getFileDownload({ bucketId, fileId: filename });
    } catch {
      throw new HttpError(404, 'Backup não encontrado');
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(Buffer.from(blob));
  }),
);

backupRouter.post(
  '/:filename/restore',
  requireAuth,
  requireRoles('ADMIN'),
  asyncHandler(async () => {
    throw new HttpError(400, 'Restauração manual indisponível: o Appwrite é a fonte de dados.');
  }),
);

backupRouter.delete(
  '/:filename',
  requireAuth,
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const { filename } = req.params;
    if (!SAFE_FILENAME.test(filename)) {
      throw new HttpError(400, 'Nome de arquivo inválido');
    }
    const bucketId = ensureBucketId();

    try {
      await storage.deleteFile({ bucketId, fileId: filename });
    } catch {
      throw new HttpError(404, 'Backup não encontrado');
    }

    await writeAudit(req.user?.id, 'BACKUP_DELETED', 'Backup', filename, undefined, req.ip);
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

/** No runtime Function quem agenda é o trigger `schedule`, não o cron local. */
export function shouldScheduleBackups(): boolean {
  return !isFunctionRuntime();
}