import prisma from './prisma';

export async function writeAudit(
  userId: number | null | undefined,
  action: string,
  entity?: string,
  entityId?: string | number,
  metadata?: unknown,
  ip?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entity: entity ?? null,
        entityId: entityId !== undefined ? String(entityId) : null,
        metadata: metadata !== undefined ? JSON.stringify(metadata) : null,
        ip: ip ?? null,
      },
    });
  } catch (err) {
    console.error('Falha ao registrar auditoria:', err);
  }
}