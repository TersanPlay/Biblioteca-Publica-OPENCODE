# Task 4: Backend — Resolve functions and bookInclude

## Task Description

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
