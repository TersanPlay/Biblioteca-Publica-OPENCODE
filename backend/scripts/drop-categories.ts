import 'dotenv/config';
import { Databases } from 'node-appwrite';
import { client, APPWRITE_DATABASE_ID } from '../src/lib/appwrite';

const dbs = new Databases(client);

async function main() {
  // 1) Remove atributos legados dos books (categoryIds/categoryNames)
  for (const key of ['categoryIds', 'categoryNames']) {
    try {
      await dbs.deleteAttribute(APPWRITE_DATABASE_ID, 'books', key);
      console.log(`Atributo books.${key} removido`);
    } catch (err: any) {
      console.log(`Atributo books.${key}: ${err?.message || err}`);
    }
  }

  // 2) Drop da collection antiga (vazia — migração já copiou dados para 'subjects')
  try {
    await dbs.deleteCollection(APPWRITE_DATABASE_ID, 'categories');
    console.log('Collection "categories" removida');
  } catch (err: any) {
    console.log(`Collection "categories": ${err?.message || err}`);
  }

  console.log('Contract concluído.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[erro]', err?.message || err);
    process.exit(1);
  });