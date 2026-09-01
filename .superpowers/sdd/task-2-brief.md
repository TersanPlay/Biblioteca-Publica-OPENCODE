# Task 2: Schema — Subject and KnowledgeArea models

## Task Description

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
