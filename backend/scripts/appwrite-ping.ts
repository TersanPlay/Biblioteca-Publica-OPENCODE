import 'dotenv/config';
import { client } from '../src/lib/appwrite';

client
  .ping()
  .then(() => {
    console.log('Appwrite OK:', client.config.endpoint);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Appwrite ping falhou:', err?.message || err);
    process.exit(1);
  });
