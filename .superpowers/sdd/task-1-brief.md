# Task 1: Schema — Enums and scalar fields

## Task Description

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
