import { createDoc, COLLECTIONS } from './store';

export async function writeAudit(
  userId: string | number | null | undefined,
  action: string,
  entity?: string,
  entityId?: string | number,
  metadata?: unknown,
  ip?: string,
): Promise<void> {
  try {
    await createDoc(COLLECTIONS.auditLogs, {
      userId: userId != null ? String(userId) : null,
      action,
      entity: entity ?? null,
      entityId: entityId !== undefined ? String(entityId) : null,
      metadata: metadata !== undefined ? JSON.stringify(metadata) : null,
      ip: ip ?? null,
    });
  } catch (err) {
    console.error('Falha ao registrar auditoria:', err);
  }
}
