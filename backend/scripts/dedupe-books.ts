import 'dotenv/config';
import { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';

const SCALAR_FIELDS = [
  'subtitle',
  'description',
  'publisher',
  'edition',
  'publicationYear',
  'language',
  'pages',
  'coverUrl',
  'isbn10',
  'isbn13',
] as const;

async function mergeInto(keeperId: number, victimId: number) {
  const loans = await prisma.loan.updateMany({ where: { bookId: victimId }, data: { bookId: keeperId } });
  const reservations = await prisma.reservation.updateMany({ where: { bookId: victimId }, data: { bookId: keeperId } });
  const victimAuthors = await prisma.bookAuthor.findMany({ where: { bookId: victimId } });
  for (const va of victimAuthors) {
    const exists = await prisma.bookAuthor.findUnique({
      where: { bookId_authorId: { bookId: keeperId, authorId: va.authorId } },
    });
    if (!exists) {
      try {
        await prisma.bookAuthor.create({ data: { bookId: keeperId, authorId: va.authorId } });
      } catch {
        /* já existia */
      }
    }
    await prisma.bookAuthor.delete({ where: { bookId_authorId: { bookId: victimId, authorId: va.authorId } } });
  }
  const victimCategories = await prisma.bookCategory.findMany({ where: { bookId: victimId } });
  for (const vc of victimCategories) {
    const exists = await prisma.bookCategory.findUnique({
      where: { bookId_categoryId: { bookId: keeperId, categoryId: vc.categoryId } },
    });
    if (!exists) {
      try {
        await prisma.bookCategory.create({ data: { bookId: keeperId, categoryId: vc.categoryId } });
      } catch {
        /* já existia */
      }
    }
    await prisma.bookCategory.delete({ where: { bookId_categoryId: { bookId: victimId, categoryId: vc.categoryId } } });
  }
  const keeper = await prisma.book.findUniqueOrThrow({ where: { id: keeperId } });
  const victim = await prisma.book.findUniqueOrThrow({ where: { id: victimId } });
  const merged: string[] = [];
  const patch: Record<string, unknown> = {};
  for (const field of SCALAR_FIELDS) {
    const k = keeper[field];
    const v = victim[field];
    if ((k === null || k === undefined) && v !== null && v !== undefined) {
      patch[field] = v;
      merged.push(field);
    }
  }
  if (Object.keys(patch).length > 0) await prisma.book.update({ where: { id: keeperId }, data: patch });
  await prisma.book.delete({ where: { id: victimId } });
  return { keeperId, victimId, merged, loansMoved: loans.count, reservationsMoved: reservations.count };
}

async function dedupeField(field: 'isbn10' | 'isbn13') {
  const rows = await prisma.$queryRaw<Array<{ k: string; c: bigint }>>(
    Prisma.sql`SELECT ${Prisma.raw(field)} AS k, COUNT(*) AS c FROM Book WHERE ${Prisma.raw(field)} IS NOT NULL GROUP BY ${Prisma.raw(field)} HAVING COUNT(*) > 1`,
  );
  const report: string[] = [];
  for (const row of rows) {
    const key = row.k;
    const members = await prisma.book.findMany({
      where: { [field]: key },
      orderBy: { id: 'asc' },
    });
    const keeper = members[0];
    report.push(`${field} ${key}: ${members.length} registros (mantém id ${keeper.id})`);
    for (const m of members.slice(1)) {
      const r = await mergeInto(keeper.id, m.id);
      report.push(`  → removido id ${r.victimId}: mesclados [${r.merged.join(', ') || 'nenhum'}], empréstimos ${r.loansMoved}, reservas ${r.reservationsMoved}`);
    }
  }
  return report;
}

async function main() {
  const out: string[] = [];
  for (const field of ['isbn10', 'isbn13'] as const) out.push(...(await dedupeField(field)));
  if (out.length === 0) console.log('Nenhum ISBN duplicado encontrado.');
  out.forEach((l) => console.log(l));
  const total = await prisma.book.count();
  console.log(`Total de livros após dedupe: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());