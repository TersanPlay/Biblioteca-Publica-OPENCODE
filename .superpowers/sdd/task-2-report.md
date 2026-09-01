# Task 2 Report: Schema — Subject and KnowledgeArea models

## Status: DONE

## What was implemented

- Added `Subject` model with `id` (autoincrement) and `name` (unique)
- Added `BookSubject` junction model with composite key `[bookId, subjectId]` and cascade delete
- Added `KnowledgeArea` model with `id` (autoincrement) and `name` (unique)
- Added `BookKnowledgeArea` junction model with composite key `[bookId, knowledgeAreaId]` and cascade delete
- Added `subjects` and `knowledgeAreas` relations to `Book` model

## Test results

- `prisma db push` — succeeded, database in sync
- `prisma generate` — succeeded, client generated

## Files changed

- `backend/prisma/schema.prisma`

## Self-review

- All 4 models match the task spec exactly
- Relations follow existing patterns (BookAuthor, BookCategory)
- Cascade delete matches existing conventions
- No overbuilding

## Commit

- `0217601` feat(book-fields): add Subject, KnowledgeArea models with many-to-many
