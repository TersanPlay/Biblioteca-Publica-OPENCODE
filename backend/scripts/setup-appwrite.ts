import 'dotenv/config';
import { ID, databases, APPWRITE_DATABASE_ID } from '../src/lib/appwrite';
import { Client, Databases } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || '6a95dd2d001313fa9653';
const apiKey = process.env.APPWRITE_API_KEY || '';

if (!apiKey) {
  console.error('[fatal] APPWRITE_API_KEY ausente — defina no backend/.env');
  process.exit(1);
}

// Client com API key para operações administrativas (criar db/collections)
const admin = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const dbs = new Databases(admin);

async function ensureDatabase(): Promise<string> {
  let databaseId = APPWRITE_DATABASE_ID;
  try {
    await dbs.get(databaseId);
    console.log(`Database "${databaseId}" já existe`);
    return databaseId;
  } catch {
    const created = await dbs.create({ databaseId, name: 'Biblioteca Pública' });
    console.log(`Database criada: ${created.$id}`);
    return created.$id;
  }
}

type Attr =
  | { kind: 'string'; key: string; size: number; required?: boolean; array?: boolean }
  | { kind: 'integer' | 'float' | 'boolean'; key: string; required?: boolean }
  | { kind: 'datetime' | 'enum'; key: string; required?: boolean; elements?: string[] };

async function ensureAttributes(dbId: string, collectionId: string, attrs: Record<string, Attr>) {
  for (const [key, def] of Object.entries(attrs)) {
    try {
      const required = def.required ?? true;
      switch (def.kind) {
        case 'string':
          await dbs.createStringAttribute({ databaseId: dbId, collectionId, key, size: def.size, required, array: def.array ?? false });
          break;
        case 'integer':
          await dbs.createIntegerAttribute({ databaseId: dbId, collectionId, key, required });
          break;
        case 'float':
          await dbs.createFloatAttribute({ databaseId: dbId, collectionId, key, required });
          break;
        case 'boolean':
          await dbs.createBooleanAttribute({ databaseId: dbId, collectionId, key, required });
          break;
        case 'datetime':
          await dbs.createDatetimeAttribute({ databaseId: dbId, collectionId, key, required });
          break;
        case 'enum':
          await dbs.createEnumAttribute({ databaseId: dbId, collectionId, key, elements: def.elements ?? [], required });
          break;
      }
      console.log(`  [${collectionId}] attr ${key} ok`);
    } catch (err: any) {
      if (err?.type === 'attribute_already_exists') { /* ok */ }
      else console.log(`  [${collectionId}] attr ${key} falhou (pode já existir): ${err?.message}`);
    }
  }
}

async function ensureCollection(dbId: string, collectionId: string, name: string, attrs: Record<string, Attr>) {
  try {
    await dbs.createCollection({ databaseId: dbId, collectionId, name });
    console.log(`Collection "${collectionId}" criada`);
  } catch (err: any) {
    if (err?.type === 'collection_already_exists') console.log(`Collection "${collectionId}" já existe`);
    else { console.log(`[${collectionId}] falha ao criar: ${err?.message}`); return; }
  }
  await ensureAttributes(dbId, collectionId, attrs);
}

async function main() {
  const dbId = await ensureDatabase();

  // users: apenas metadados — identidade/password ficam no Appwrite Auth (Users)
  await ensureCollection(dbId, 'users', 'Usuários', {
    appwriteUserId: { kind: 'string', key: 'appwriteUserId', size: 64 },
    name: { kind: 'string', key: 'name', size: 200 },
    email: { kind: 'string', key: 'email', size: 254 },
    role: { kind: 'enum', key: 'role', elements: ['ADMIN', 'ATTENDANT'] },
    status: { kind: 'string', key: 'status', size: 20 },
  });

  // settings: config unica
  await ensureCollection(dbId, 'settings', 'Configurações', {
    loanLimit: { kind: 'integer', key: 'loanLimit' },
    defaultLoanDays: { kind: 'integer', key: 'defaultLoanDays' },
    maxRenewals: { kind: 'integer', key: 'maxRenewals' },
    libraryName: { kind: 'string', key: 'libraryName', size: 500, required: false },
    libraryAddress: { kind: 'string', key: 'libraryAddress', size: 500, required: false },
    libraryPhone: { kind: 'string', key: 'libraryPhone', size: 100, required: false },
    libraryEmail: { kind: 'string', key: 'libraryEmail', size: 254, required: false },
    libraryHours: { kind: 'string', key: 'libraryHours', size: 500, required: false },
  });

  // readers
  await ensureCollection(dbId, 'readers', 'Leitores', {
    name: { kind: 'string', key: 'name', size: 200 },
    cpf: { kind: 'string', key: 'cpf', size: 20 },
    birthDate: { kind: 'string', key: 'birthDate', size: 40, required: false },
    phone: { kind: 'string', key: 'phone', size: 60, required: false },
    email: { kind: 'string', key: 'email', size: 254, required: false },
    cep: { kind: 'string', key: 'cep', size: 20, required: false },
    address: { kind: 'string', key: 'address', size: 300, required: false },
    number: { kind: 'string', key: 'number', size: 20, required: false },
    neighborhood: { kind: 'string', key: 'neighborhood', size: 150, required: false },
    city: { kind: 'string', key: 'city', size: 150, required: false },
    state: { kind: 'string', key: 'state', size: 10, required: false },
    status: { kind: 'string', key: 'status', size: 20 },
    deletedAt: { kind: 'string', key: 'deletedAt', size: 40, required: false },
    anonymizedAt: { kind: 'string', key: 'anonymizedAt', size: 40, required: false },
    blockReason: { kind: 'string', key: 'blockReason', size: 500, required: false },
    blockCategory: { kind: 'string', key: 'blockCategory', size: 50, required: false },
    blockedAt: { kind: 'string', key: 'blockedAt', size: 40, required: false },
    blockedBy: { kind: 'string', key: 'blockedBy', size: 64, required: false },
  });

  // authors / categories / knowledgeAreas (find-or-create)
  await ensureCollection(dbId, 'authors', 'Autores', {
    name: { kind: 'string', key: 'name', size: 200 },
    isActive: { kind: 'boolean', key: 'isActive', required: false },
  });
  await ensureCollection(dbId, 'categories', 'Categorias', {
    name: { kind: 'string', key: 'name', size: 200 },
    description: { kind: 'string', key: 'description', size: 500, required: false },
    status: { kind: 'string', key: 'status', size: 20 },
  });
  await ensureCollection(dbId, 'knowledgeAreas', 'Áreas de conhecimento', {
    name: { kind: 'string', key: 'name', size: 200 },
  });

  // books — relationships denormalized como arrays de ids/nomes
  await ensureCollection(dbId, 'books', 'Livros', {
    title: { kind: 'string', key: 'title', size: 500 },
    subtitle: { kind: 'string', key: 'subtitle', size: 500, required: false },
    isbn10: { kind: 'string', key: 'isbn10', size: 30, required: false },
    isbn13: { kind: 'string', key: 'isbn13', size: 30, required: false },
    description: { kind: 'string', key: 'description', size: 5000, required: false },
    publisher: { kind: 'string', key: 'publisher', size: 300, required: false },
    edition: { kind: 'integer', key: 'edition', required: false },
    publicationYear: { kind: 'integer', key: 'publicationYear', required: false },
    language: { kind: 'string', key: 'language', size: 60, required: false },
    pages: { kind: 'integer', key: 'pages', required: false },
    coverUrl: { kind: 'string', key: 'coverUrl', size: 500, required: false },
    format: { kind: 'string', key: 'format', size: 20, required: false },
    volume: { kind: 'string', key: 'volume', size: 60, required: false },
    cdd: { kind: 'string', key: 'cdd', size: 60, required: false },
    cutter: { kind: 'string', key: 'cutter', size: 60, required: false },
    physicalLocation: { kind: 'string', key: 'physicalLocation', size: 200, required: false },
    availableCopies: { kind: 'integer', key: 'availableCopies', required: false },
    acquisitionType: { kind: 'string', key: 'acquisitionType', size: 40, required: false },
    isArchived: { kind: 'boolean', key: 'isArchived', required: false },
    authorIds: { kind: 'string', key: 'authorIds', size: 2000, required: false, array: true },
    authorNames: { kind: 'string', key: 'authorNames', size: 2000, required: false, array: true },
    categoryIds: { kind: 'string', key: 'categoryIds', size: 2000, required: false, array: true },
    categoryNames: { kind: 'string', key: 'categoryNames', size: 2000, required: false, array: true },
    knowledgeAreaIds: { kind: 'string', key: 'knowledgeAreaIds', size: 2000, required: false, array: true },
    knowledgeAreaNames: { kind: 'string', key: 'knowledgeAreaNames', size: 2000, required: false, array: true },
  });

  // loans — snapshots já denormalizados (padrão do schema original)
  await ensureCollection(dbId, 'loans', 'Empréstimos', {
    number: { kind: 'string', key: 'number', size: 60, required: false },
    readerId: { kind: 'string', key: 'readerId', size: 64 },
    bookId: { kind: 'string', key: 'bookId', size: 64 },
    userId: { kind: 'string', key: 'userId', size: 64 },
    loanDate: { kind: 'string', key: 'loanDate', size: 40 },
    dueDate: { kind: 'string', key: 'dueDate', size: 40 },
    returnedAt: { kind: 'string', key: 'returnedAt', size: 40, required: false },
    renewals: { kind: 'integer', key: 'renewals', required: false },
    notes: { kind: 'string', key: 'notes', size: 1000, required: false },
    status: { kind: 'string', key: 'status', size: 20 },
    readerNameSnapshot: { kind: 'string', key: 'readerNameSnapshot', size: 200, required: false },
    bookTitleSnapshot: { kind: 'string', key: 'bookTitleSnapshot', size: 500, required: false },
    bookAuthorSnapshot: { kind: 'string', key: 'bookAuthorSnapshot', size: 500, required: false },
    bookIsbnSnapshot: { kind: 'string', key: 'bookIsbnSnapshot', size: 50, required: false },
    bookNumberSnapshot: { kind: 'string', key: 'bookNumberSnapshot', size: 120, required: false },
    createdByNameSnapshot: { kind: 'string', key: 'createdByNameSnapshot', size: 200, required: false },
    returnCondition: { kind: 'string', key: 'returnCondition', size: 20, required: false },
    returnObservations: { kind: 'string', key: 'returnObservations', size: 500, required: false },
    receivedByNameSnapshot: { kind: 'string', key: 'receivedByNameSnapshot', size: 200, required: false },
  });

  // reservations
  await ensureCollection(dbId, 'reservations', 'Reservas', {
    readerId: { kind: 'string', key: 'readerId', size: 64 },
    bookId: { kind: 'string', key: 'bookId', size: 64 },
    status: { kind: 'string', key: 'status', size: 20 },
    expiresAt: { kind: 'string', key: 'expiresAt', size: 40, required: false },
    fulfilledAt: { kind: 'string', key: 'fulfilledAt', size: 40, required: false },
  });

  // auditLogs
  await ensureCollection(dbId, 'auditLogs', 'Auditoria', {
    userId: { kind: 'string', key: 'userId', size: 64, required: false },
    action: { kind: 'string', key: 'action', size: 100 },
    entity: { kind: 'string', key: 'entity', size: 60, required: false },
    entityId: { kind: 'string', key: 'entityId', size: 64, required: false },
    metadata: { kind: 'string', key: 'metadata', size: 4000, required: false },
    ip: { kind: 'string', key: 'ip', size: 60, required: false },
  });

  console.log('Setup Appwrite concluído.');
}

main().catch((err) => {
  if (err?.type === 'project_not_found' || err?.type === 'unauthorized_scope') {
    console.error('[fatal] Falha de autenticação Appwrite. Confira APPWRITE_API_KEY e scopes da chave.');
  } else {
    console.error('[erro]', err);
  }
  process.exit(1);
});
