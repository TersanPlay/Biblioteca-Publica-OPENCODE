# Novos Campos no Cadastro de Livros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar 9 novos campos bibliográficos ao formulário de cadastro de livros (Formato Físico, Volume, Assuntos, Área de Conhecimento, CDD, Cutter, Localização Física, Cópias Disponíveis, Tipo de Aquisição).

**Architecture:** 2 migrations sequenciais (enums+scalar → tabelas Subject/KnowledgeArea), backend API com validação Zod, frontend com formulário reorganizado em 6 seções.

**Tech Stack:** Prisma 5, SQLite, Express, Zod, React, TypeScript, Tailwind, react-hook-form

## Global Constraints

- SQLite database (`backend/prisma/dev.db`)
- JWT auth with `requireAuth` middleware
- Anti-mock policy: no fictitious data
- All fields optional (none required)
- Migrations reversible
- Validation: Zod backend, react-hook-form frontend

---

## File Structure

### Modified files
- `backend/prisma/schema.prisma` — add enums, scalar fields, Subject/KnowledgeArea models
- `backend/src/validation.ts` — extend bookSchema with new fields
- `backend/src/modules/book.routes.ts` — add resolve functions, update CREATE/UPDATE
- `frontend/src/types/api.ts` — add BookFormat, AcquisitionType, Subject, KnowledgeArea types
- `frontend/src/features/api.ts` — add subjectsApi, knowledgeAreasApi
- `frontend/src/pages/admin/book-form.tsx` — reorganize form into 6 sections
- `frontend/src/pages/admin/books.tsx` — add Formato column and filter

---

### Task 1: Schema — Enums and scalar fields

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: BookFormat enum, AcquisitionType enum, scalar fields on Book

- [ ] **Step 1: Add enums to schema.prisma**

In `backend/prisma/schema.prisma`, add before the Book model:

```prisma
enum BookFormat {
  CAPA
  BROCHURA
  ESPIRAL
}

enum AcquisitionType {
  COMPRA
  DOACAO
  REPOSICAO
  PRODUCAO_INTERNA
  TROCA
  EMPRESTIMO_BIBLIOTECAS
  LICITACAO
  PERMUTA
  CONVENIO
}
```

- [ ] **Step 2: Add scalar fields to Book model**

In `backend/prisma/schema.prisma`, add after `coverUrl` in the Book model:

```prisma
  format            BookFormat?
  volume            String?
  cdd               String?
  cutter            String?
  physicalLocation  String?
  availableCopies   Int?
  acquisitionType   AcquisitionType?
```

- [ ] **Step 3: Push schema to database**

Run: `cd backend && npx prisma db push`
Expected: Schema updated, no errors

- [ ] **Step 4: Regenerate Prisma Client**

Run: `cd backend && npx prisma generate`
Expected: Prisma Client generated

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(book-fields): add BookFormat, AcquisitionType enums and scalar fields"
```

---

### Task 2: Schema — Subject and KnowledgeArea models

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: Subject model, BookSubject model, KnowledgeArea model, BookKnowledgeArea model

- [ ] **Step 1: Add Subject and BookSubject models**

In `backend/prisma/schema.prisma`, add after the Book model:

```prisma
model Subject {
  id    Int    @id @default(autoincrement())
  name  String @unique
  books BookSubject[]
}

model BookSubject {
  bookId    Int
  subjectId Int
  book      Book    @relation(fields: [bookId], references: [id], onDelete: Cascade)
  subject   Subject @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  @@id([bookId, subjectId])
}
```

- [ ] **Step 2: Add KnowledgeArea and BookKnowledgeArea models**

In `backend/prisma/schema.prisma`, add after BookSubject:

```prisma
model KnowledgeArea {
  id    Int    @id @default(autoincrement())
  name  String @unique
  books BookKnowledgeArea[]
}

model BookKnowledgeArea {
  bookId          Int
  knowledgeAreaId Int
  book            Book          @relation(fields: [bookId], references: [id], onDelete: Cascade)
  knowledgeArea   KnowledgeArea @relation(fields: [knowledgeAreaId], references: [id], onDelete: Cascade)
  @@id([bookId, knowledgeAreaId])
}
```

- [ ] **Step 3: Add relations to Book model**

In `backend/prisma/schema.prisma`, add to the Book model:

```prisma
  subjects          BookSubject[]
  knowledgeAreas    BookKnowledgeArea[]
```

- [ ] **Step 4: Push schema to database**

Run: `cd backend && npx prisma db push`
Expected: Schema updated, no errors

- [ ] **Step 5: Regenerate Prisma Client**

Run: `cd backend && npx prisma generate`
Expected: Prisma Client generated

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(book-fields): add Subject, KnowledgeArea models with many-to-many"
```

---

### Task 3: Backend — Validation schema

**Files:**
- Modify: `backend/src/validation.ts` (bookSchema)

**Interfaces:**
- Produces: Extended bookSchema with new fields

- [ ] **Step 1: Extend bookSchema**

In `backend/src/validation.ts`, add to bookSchema after `coverUrl`:

```typescript
  format: z.enum(['CAPA', 'BROCHURA', 'ESPIRAL']).optional(),
  volume: strOpt,
  cdd: strOpt,
  cutter: strOpt,
  physicalLocation: strOpt,
  availableCopies: intOpt,
  acquisitionType: z.enum([
    'COMPRA','DOACAO','REPOSICAO','PRODUCAO_INTERNA',
    'TROCA','EMPRESTIMO_BIBLIOTECAS','LICITACAO','PERMUTA','CONVENIO'
  ]).optional(),
  subjectNames: z.array(z.string().trim().min(2, 'nome de assunto muito curto').max(120)).default([]),
  subjectIds: z.array(z.number().int()).default([]),
  knowledgeAreaNames: z.array(z.string().trim().min(2, 'nome de area muito curto').max(120)).default([]),
  knowledgeAreaIds: z.array(z.number().int()).default([]),
```

- [ ] **Step 2: Verify typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/validation.ts
git commit -m "feat(book-fields): extend bookSchema with new fields"
```

---

### Task 4: Backend — Resolve functions and bookInclude

**Files:**
- Modify: `backend/src/modules/book.routes.ts`

**Interfaces:**
- Produces: `resolveSubjectNames()`, `resolveKnowledgeAreaNames()`, updated `bookInclude`

- [ ] **Step 1: Add resolveSubjectNames function**

In `backend/src/modules/book.routes.ts`, add after `resolveCategoryNames`:

```typescript
async function resolveSubjectNames(
  tx: Prisma.TransactionClient,
  names: string[],
): Promise<{ ids: number[]; created: { id: number; name: string }[] }> {
  const ids: number[] = [];
  const created: { id: number; name: string }[] = [];
  if (names.length === 0) return { ids, created };
  const all = await tx.subject.findMany({ select: { id: true, name: true } });
  const nameMap = new Map(all.map((s) => [s.name.toLowerCase(), s.id]));
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existingId = nameMap.get(key);
    if (existingId) {
      ids.push(existingId);
    } else {
      const subject = await tx.subject.create({ data: { name } });
      created.push({ id: subject.id, name: subject.name });
      nameMap.set(key, subject.id);
      ids.push(subject.id);
    }
  }
  return { ids, created };
}
```

- [ ] **Step 2: Add resolveKnowledgeAreaNames function**

In `backend/src/modules/book.routes.ts`, add after `resolveSubjectNames`:

```typescript
async function resolveKnowledgeAreaNames(
  tx: Prisma.TransactionClient,
  names: string[],
): Promise<{ ids: number[]; created: { id: number; name: string }[] }> {
  const ids: number[] = [];
  const created: { id: number; name: string }[] = [];
  if (names.length === 0) return { ids, created };
  const all = await tx.knowledgeArea.findMany({ select: { id: true, name: true } });
  const nameMap = new Map(all.map((k) => [k.name.toLowerCase(), k.id]));
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existingId = nameMap.get(key);
    if (existingId) {
      ids.push(existingId);
    } else {
      const knowledgeArea = await tx.knowledgeArea.create({ data: { name } });
      created.push({ id: knowledgeArea.id, name: knowledgeArea.name });
      nameMap.set(key, knowledgeArea.id);
      ids.push(knowledgeArea.id);
    }
  }
  return { ids, created };
}
```

- [ ] **Step 3: Update bookInclude**

In `backend/src/modules/book.routes.ts`, update the `bookInclude` object:

```typescript
export const bookInclude = {
  categories: { include: { category: true } },
  authors: { include: { author: true } },
  subjects: { include: { subject: true } },
  knowledgeAreas: { include: { knowledgeArea: true } },
};
```

- [ ] **Step 4: Verify typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/book.routes.ts
git commit -m "feat(book-fields): add resolveSubjectNames, resolveKnowledgeAreaNames, update bookInclude"
```

---

### Task 5: Backend — Update CREATE/UPDATE endpoints

**Files:**
- Modify: `backend/src/modules/book.routes.ts` (POST / and PUT /:id)

**Interfaces:**
- Consumes: resolveSubjectNames, resolveKnowledgeAreaNames from Task 4
- Produces: CREATE/UPDATE endpoints handle new fields

- [ ] **Step 1: Update CREATE endpoint**

In `backend/src/modules/book.routes.ts`, find the POST `/` endpoint and update to destructure new fields:

```typescript
const { categoryIds, categoryNames, authorIds, authorNames, subjectIds, subjectNames, knowledgeAreaIds, knowledgeAreaNames, ...rest } = data;
```

And add to the transaction:

```typescript
const resolvedSubjects = await resolveSubjectNames(tx, subjectNames);
const resolvedKnowledgeAreas = await resolveKnowledgeAreaNames(tx, knowledgeAreaNames);
```

And add to the create data:

```typescript
subjects: {
  create: [
    ...subjectIds.map((id) => ({ subject: { connect: { id } } })),
    ...resolvedSubjects.created.map((s) => ({ subject: { connect: { id: s.id } } })),
  ],
},
knowledgeAreas: {
  create: [
    ...knowledgeAreaIds.map((id) => ({ knowledgeArea: { connect: { id } } })),
    ...resolvedKnowledgeAreas.created.map((k) => ({ knowledgeArea: { connect: { id: k.id } } })),
  ],
},
```

- [ ] **Step 2: Update UPDATE endpoint**

In `backend/src/modules/book.routes.ts`, find the PUT `/:id` endpoint and add:

```typescript
await tx.bookSubject.deleteMany({ where: { bookId: id } });
await tx.bookKnowledgeArea.deleteMany({ where: { bookId: id } });
```

And destructure new fields:

```typescript
const { categoryIds, categoryNames, authorIds, authorNames, subjectIds, subjectNames, knowledgeAreaIds, knowledgeAreaNames, ...rest } = data;
```

And add to the transaction:

```typescript
const resolvedSubjects = await resolveSubjectNames(tx, subjectNames);
const resolvedKnowledgeAreas = await resolveKnowledgeAreaNames(tx, knowledgeAreaNames);
```

And add to the update data:

```typescript
subjects: {
  create: [
    ...subjectIds.map((id) => ({ subject: { connect: { id } } })),
    ...resolvedSubjects.created.map((s) => ({ subject: { connect: { id: s.id } } })),
  ],
},
knowledgeAreas: {
  create: [
    ...knowledgeAreaIds.map((id) => ({ knowledgeArea: { connect: { id } } })),
    ...resolvedKnowledgeAreas.created.map((k) => ({ knowledgeArea: { connect: { id: k.id } } })),
  ],
},
```

- [ ] **Step 3: Verify typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/book.routes.ts
git commit -m "feat(book-fields): update CREATE/UPDATE endpoints with new fields"
```

---

### Task 6: Frontend — Types and API

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/features/api.ts`

**Interfaces:**
- Produces: BookFormat, AcquisitionType, Subject, KnowledgeArea types, subjectsApi, knowledgeAreasApi

- [ ] **Step 1: Add new types to api.ts**

In `frontend/src/types/api.ts`, add after the existing types:

```typescript
export type BookFormat = 'CAPA' | 'BROCHURA' | 'ESPIRAL';
export type AcquisitionType = 'COMPRA' | 'DOACAO' | 'REPOSICAO' | 'PRODUCAO_INTERNA' | 'TROCA' | 'EMPRESTIMO_BIBLIOTECAS' | 'LICITACAO' | 'PERMUTA' | 'CONVENIO';

export interface Subject {
  id: number;
  name: string;
}

export interface KnowledgeArea {
  id: number;
  name: string;
}
```

- [ ] **Step 2: Update Book interface**

In `frontend/src/types/api.ts`, add to the Book interface:

```typescript
  format: BookFormat | null;
  volume: string | null;
  cdd: string | null;
  cutter: string | null;
  physicalLocation: string | null;
  availableCopies: number | null;
  acquisitionType: AcquisitionType | null;
  subjects: Subject[];
  knowledgeAreas: KnowledgeArea[];
```

- [ ] **Step 3: Add API methods**

In `frontend/src/features/api.ts`, add after the existing APIs:

```typescript
export const subjectsApi = {
  all: () => api.get<Subject[]>('/subjects').then((r) => r.data),
};

export const knowledgeAreasApi = {
  all: () => api.get<KnowledgeArea[]>('/knowledge-areas').then((r) => r.data),
};
```

- [ ] **Step 4: Add imports**

In `frontend/src/features/api.ts`, add to the import:

```typescript
import type { Subject, KnowledgeArea } from '../types/api';
```

- [ ] **Step 5: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/features/api.ts
git commit -m "feat(book-fields): add Subject, KnowledgeArea types and API methods"
```

---

### Task 7: Frontend — Book form reorganization

**Files:**
- Modify: `frontend/src/pages/admin/book-form.tsx`

**Interfaces:**
- Consumes: BookFormat, AcquisitionType, Subject, KnowledgeArea types
- Produces: Reorganized form with 6 sections

- [ ] **Step 1: Add imports and state**

In `frontend/src/pages/admin/book-form.tsx`:

```typescript
import { subjectsApi, knowledgeAreasApi } from '../../features/api';
```

Add state:

```typescript
const [subjects, setSubjects] = useState<Subject[]>([]);
const [knowledgeAreas, setKnowledgeAreas] = useState<KnowledgeArea[]>([]);
```

- [ ] **Step 2: Fetch subjects and knowledge areas**

Add useEffect:

```typescript
useEffect(() => {
  Promise.all([subjectsApi.all(), knowledgeAreasApi.all()])
    .then(([s, k]) => { setSubjects(s); setKnowledgeAreas(k); })
    .catch(() => undefined);
}, []);
```

- [ ] **Step 3: Add form fields to schema**

Add to the z.object schema:

```typescript
format: z.enum(['CAPA', 'BROCHURA', 'ESPIRAL']).optional(),
volume: z.string(),
cdd: z.string(),
cutter: z.string(),
physicalLocation: z.string(),
availableCopies: z.string(),
acquisitionType: z.enum(['COMPRA','DOACAO','REPOSICAO','PRODUCAO_INTERNA','TROCA','EMPRESTIMO_BIBLIOTECAS','LICITACAO','PERMUTA','CONVENIO']).optional(),
subjects: z.array(z.object({ id: z.number().nullable(), name: z.string().trim().min(1) })),
knowledgeAreas: z.array(z.object({ id: z.number().nullable(), name: z.string().trim().min(1) })),
```

- [ ] **Step 4: Update defaultValues**

```typescript
format: undefined, volume: '', cdd: '', cutter: '', physicalLocation: '',
availableCopies: '', acquisitionType: undefined, subjects: [], knowledgeAreas: [],
```

- [ ] **Step 5: Reorganize form layout into 6 sections**

Section 1: Título, Subtítulo, ISBN-10, ISBN-13
Section 2: Editora, Ano, Edição, Volume, Idioma, Páginas, Formato Físico
Section 3: CDD, Cutter, Assuntos, Área de Conhecimento
Section 4: Cópias Disponíveis, Localização Física, Tipo de Aquisição
Section 5: Descrição, URL da Capa
Section 6: Autores, Categorias (existentes)

- [ ] **Step 6: Add autocomplete for Subject and KnowledgeArea**

Similar to existing CategoryInput pattern.

- [ ] **Step 7: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/admin/book-form.tsx
git commit -m "feat(book-fields): reorganize book form with 6 sections and new fields"
```

---

### Task 8: Frontend — Books list updates

**Files:**
- Modify: `frontend/src/pages/admin/books.tsx`

**Interfaces:**
- Consumes: BookFormat type
- Produces: Formato column and filter in books list

- [ ] **Step 1: Add Formato column**

In `frontend/src/pages/admin/books.tsx`, add to the table header:

```tsx
<TH>Formato</TH>
```

And add to the table body:

```tsx
<TD>
  {b.format ? (
    <Badge variant="primary">{FORMAT_LABELS[b.format]}</Badge>
  ) : (
    <span className="text-muted">—</span>
  )}
</TD>
```

- [ ] **Step 2: Add format labels**

```typescript
const FORMAT_LABELS: Record<string, string> = {
  CAPA: 'Capa',
  BROCHURA: 'Brochura',
  ESPIRAL: 'Espiral',
};
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/books.tsx
git commit -m "feat(book-fields): add Formato column to books list"
```

---

### Task 9: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Full backend typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Full frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(book-fields): complete book fields module"
```
