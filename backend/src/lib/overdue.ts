import { listDocs, updateDoc, COLLECTIONS } from './store';

async function bulkUpdateStatus(
  collection: (typeof COLLECTIONS)[keyof typeof COLLECTIONS],
  ids: string[],
  status: string,
) {
  for (const id of ids) {
    await updateDoc(collection, id, { status });
  }
}

export async function refreshOverdue(readerId?: string): Promise<void> {
  const now = new Date();
  const loans = await listDocs(COLLECTIONS.loans, {
    pageSize: 500,
    orderBy: { attr: 'createdAt', direction: 'desc' },
  });
  const toOverdue: string[] = [];
  for (const loan of loans.docs) {
    if (loan.status !== 'ACTIVE') continue;
    if (loan.returnedAt) continue;
    if (!loan.dueDate) continue;
    if (readerId && loan.readerId !== readerId) continue;
    if (new Date(loan.dueDate).getTime() < now.getTime()) {
      toOverdue.push(loan.$id);
    }
  }
  if (toOverdue.length > 0) {
    await bulkUpdateStatus(COLLECTIONS.loans, toOverdue, 'OVERDUE');
  }
}

export async function expireReservations(): Promise<void> {
  const now = new Date();
  const rows = await listDocs(COLLECTIONS.reservations, {
    pageSize: 500,
    orderBy: { attr: 'createdAt', direction: 'desc' },
  });
  const toExpire: string[] = [];
  for (const r of rows.docs) {
    if (r.status !== 'PENDING') continue;
    if (!r.expiresAt) continue;
    if (new Date(r.expiresAt).getTime() < now.getTime()) {
      toExpire.push(r.$id);
    }
  }
  if (toExpire.length > 0) {
    await bulkUpdateStatus(COLLECTIONS.reservations, toExpire, 'EXPIRED');
  }
}

export const MS_PER_DAY = 86400000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function computeDueDate(from: Date, days: number): Date {
  return addDays(from, days);
}

export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}
