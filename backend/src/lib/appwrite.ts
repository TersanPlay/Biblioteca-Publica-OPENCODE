import 'dotenv/config';
import {
  Account,
  Client,
  Databases,
  ID,
  Models,
  Query,
  Storage,
  Users,
} from 'node-appwrite';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (process.env.NODE_ENV === 'test') return value ?? '';
  if (!value) {
    // não derruba o servidor apenas porque uma var opcional falta no boot
    return '';
  }
  return value;
}

/** True quando rodando dentro de uma Appwrite Function (executor injeta este ID). */
export function isFunctionRuntime(): boolean {
  return Boolean(process.env.APPWRITE_FUNCTION_ID);
}

export const APPWRITE_ENDPOINT =
  process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '6a95dd2d001313fa9653';
export const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'biblioteca';
export const APPWRITE_BACKUP_BUCKET_ID =
  process.env.APPWRITE_BACKUP_BUCKET_ID || 'biblioteca-backups';

export const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

// Dentro de uma Function o runtime injeta uma chave dinâmica com escopo herdado;
// fora dela (dev/local) usamos a APPWRITE_API_KEY do .env.
const apiKey = process.env.APPWRITE_FUNCTION_API_KEY || process.env.APPWRITE_API_KEY;
if (apiKey) {
  client.setKey(apiKey);
}

export const databases = new Databases(client);
export const users = new Users(client);
export const account = new Account(client);
export const storage = new Storage(client);

export { ID, Query };
export type { Models };

export async function pingAppwrite(): Promise<boolean> {
  try {
    await databases.list();
    return true;
  } catch {
    return false;
  }
}