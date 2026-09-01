import 'dotenv/config';
import { Client, Databases, Users, Account, ID, Query, Models } from 'node-appwrite';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (process.env.NODE_ENV === 'test') return value ?? '';
  if (!value) {
    // não derruba o servidor apenas porque uma var opcional falta no boot
    return '';
  }
  return value;
}

export const APPWRITE_ENDPOINT =
  process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || '6a95dd2d001313fa9653';
export const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'biblioteca';

export const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

if (process.env.APPWRITE_API_KEY) {
  client.setKey(process.env.APPWRITE_API_KEY);
}

export const databases = new Databases(client);
export const users = new Users(client);
export const account = new Account(client);

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
