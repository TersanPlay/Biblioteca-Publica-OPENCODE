import 'dotenv/config';
import { Databases, Query } from 'node-appwrite';
import { client, APPWRITE_DATABASE_ID } from '../src/lib/appwrite';

const dbs = new Databases(client);
const MAX_PAGE = 100;

async function sync() {
  const docs: any[] = [];
  let offset = 0;
  for (;;) {
    const res = await dbs.listDocuments(APPWRITE_DATABASE_ID, 'books', [
      Query.limit(MAX_PAGE),
      Query.offset(offset),
    ]);
    docs.push(...res.documents);
    if (docs.length >= res.total || res.documents.length === 0) break;
    offset += res.documents.length;
  }

  let updated = 0;
  for (const book of docs) {
    const needsSync = (book.categoryIds?.length ?? 0) > 0;
    if (!needsSync) continue;
    await dbs.updateDocument(APPWRITE_DATABASE_ID, 'books', book.$id, {
      subjectIds: book.categoryIds,
      subjectNames: book.categoryNames,
    });
    updated++;
  }
  console.log(`Livros com categoria a migrar: ${updated}`);
  console.log(`Total de livros analisados: ${docs.length}`);
}

sync()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[erro]', err?.message || err);
    process.exit(1);
  });
