# Task 3: Backend — Validation schema

## Task Description

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
