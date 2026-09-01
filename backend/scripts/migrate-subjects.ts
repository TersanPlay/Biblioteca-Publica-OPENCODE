import 'dotenv/config';
import { Databases, Query } from 'node-appwrite';
import { client, APPWRITE_DATABASE_ID } from '../src/lib/appwrite';

const dbs = new Databases(client);
const MAX_PAGE = 100;

const SRC = 'categories';
const DST = 'subjects';

async function listAll(collection: string): Promise<any[]> {
  const docs: any[] = [];
  let offset = 0;
  for (;;) {
    const res = await dbs.listDocuments(APPWRITE_DATABASE_ID, collection, [
      Query.limit(MAX_PAGE),
      Query.offset(offset),
    ]);
    docs.push(...res.documents);
    if (docs.length >= res.total || res.documents.length === 0) break;
    offset += res.documents.length;
  }
  return docs;
}

async function main() {
  const categories = await listAll(SRC);
  const subjects = await listAll(DST);

  const existing = new Set(subjects.map((s) => s.$id));

  let copied = 0;
  let skipped = 0;
  for (const cat of categories) {
    if (existing.has(cat.$id)) {
      skipped++;
      continue;
    }
    await dbs.createDocument(APPWRITE_DATABASE_ID, DST, cat.$id, {
      name: cat.name ?? '',
      description: cat.description ?? undefined,
      status: cat.status ?? 'active',
    });
    copied++;
  }
  console.log(`Categorias lidas: ${categories.length}`);
  console.log(`Assuntos copiados: ${copied}, já existentes (skip): ${skipped}`);
  console.log(`Total de assuntos em ${DST}: ${subjects.length + copied}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[erro]', err?.message || err);
    process.exit(1);
  });
