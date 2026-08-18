import prisma from './prisma';

export async function refreshOverdue(readerId?: number): Promise<void> {
  const now = new Date();
  const where = {
    returnedAt: null,
    dueDate: { lt: now },
    status: 'ACTIVE' as const,
    ...(readerId ? { readerId } : {}),
  };
  const loans = await prisma.loan.findMany({ where, select: { id: true } });
  if (loans.length > 0) {
    await prisma.loan.updateMany({
      where: { id: { in: loans.map((l) => l.id) } },
      data: { status: 'OVERDUE' },
    });
  }
}

export async function expireReservations(): Promise<void> {
  const now = new Date();
  const rows = await prisma.reservation.findMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    select: { id: true },
  });
  if (rows.length > 0) {
    await prisma.reservation.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { status: 'EXPIRED' },
    });
  }
}

const MS_PER_DAY = 86400000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function computeDueDate(from: Date, days: number): Date {
  return addDays(from, days);
}

export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}