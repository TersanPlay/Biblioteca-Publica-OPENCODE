import {
  ID,
  Query,
  databases,
  APPWRITE_DATABASE_ID,
  type Models,
} from './appwrite';

export type Doc = Models.Document & Record<string, any>;
export type DocList = Models.DocumentList<Doc>;

export const COLLECTIONS = {
  users: 'users',
  settings: 'settings',
  readers: 'readers',
  authors: 'authors',
  categories: 'categories',
  knowledgeAreas: 'knowledgeAreas',
  books: 'books',
  loans: 'loans',
  reservations: 'reservations',
  auditLogs: 'auditLogs',
} as const;

export type CollectionId = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Cria ou reutiliza de forma idempotente um id legível (ex.: slug + sufixo). */
export function uniqueId(prefix: string): string {
  return `${prefix}_${ID.unique().toLowerCase()}`;
}

const MAX_PAGE = 100;

/**
 * Lista documentos. Para pageSize > MAX_PAGE, itera paginando internamente para
 * que o `total` e `docs` reflitam todos os registros (idempotente ao relacional).
 */
export async function listDocs(
  collection: CollectionId,
  opts: {
    queries?: string[];
    page?: number;
    pageSize?: number;
    orderBy?: { attr: string; direction: 'asc' | 'desc' };
    total?: boolean;
  } = {},
): Promise<{ docs: Doc[]; total: number }> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 25;
  const queries = [...(opts.queries ?? [])];
  if (opts.orderBy) {
    // Appwrite usa $createdAt/$updatedAt como metadados; createdAt/updatedAt não são atributos reais.
    const attr =
      opts.orderBy.attr === 'createdAt'
        ? '$createdAt'
        : opts.orderBy.attr === 'updatedAt'
          ? '$updatedAt'
          : opts.orderBy.attr;
    if (opts.orderBy.direction === 'asc') queries.push(Query.orderAsc(attr));
    else queries.push(Query.orderDesc(attr));
  }
  queries.push(Query.limit(MAX_PAGE));

  // Paginação "tudo" quando pageSize excede o limite da API
  if (pageSize > MAX_PAGE) {
    const docs: Doc[] = [];
    let offset = 0;
    let total = 0;
    for (;;) {
      const pageQueries = [...queries, Query.offset(offset)];
      const res = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        collection,
        pageQueries,
        undefined,
        true,
      );
      total = res.total;
      docs.push(...res.documents);
      if (docs.length >= total || res.documents.length === 0) break;
      offset += res.documents.length;
    }
    return { docs, total };
  }

  queries.push(Query.offset((page - 1) * pageSize));
  const res = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    collection,
    queries,
    undefined,
    opts.total ?? true,
  );
  return { docs: res.documents, total: res.total };
}

export async function getDoc(collection: CollectionId, id: string): Promise<Doc | null> {
  try {
    return await databases.getDocument(APPWRITE_DATABASE_ID, collection, id);
  } catch {
    return null;
  }
}

export async function createDoc(
  collection: CollectionId,
  data: Record<string, unknown>,
  id?: string,
): Promise<Doc> {
  return databases.createDocument(
    APPWRITE_DATABASE_ID,
    collection,
    id || ID.unique(),
    data,
  );
}

export async function updateDoc(
  collection: CollectionId,
  id: string,
  data: Record<string, unknown>,
): Promise<Doc> {
  return databases.updateDocument(APPWRITE_DATABASE_ID, collection, id, data);
}

export async function deleteDoc(collection: CollectionId, id: string): Promise<void> {
  await databases.deleteDocument(APPWRITE_DATABASE_ID, collection, id);
}

export async function countDocs(
  collection: CollectionId,
  queries: string[] = [],
): Promise<number> {
  const res = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    collection,
    [...queries, Query.limit(1)],
    undefined,
    true,
  );
  return res.total;
}

/** Busca um doc por atributo único (usa Query.equal). Retorna null se não achar. */
export async function findDocBy(
  collection: CollectionId,
  attr: string,
  value: string | number | boolean,
): Promise<Doc | null> {
  const res = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    collection,
    [Query.equal(attr, value), Query.limit(1)],
    undefined,
    true,
  );
  return res.documents[0] ?? null;
}

export function toId(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

export function toInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function toBool(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  return Boolean(value);
}
