### Task 5: Backend — Auto-block after 2 overdue loans

**Files:**
- Modify: `backend/src/modules/loan.routes.ts:235-263` (POST /:id/return)

**Interfaces:**
- Consumes: Reader model with block fields (Task 1)
- Produces: Auto-block logic triggered on loan return

- [ ] **Step 1: Add auto-block check after return**

In `backend/src/modules/loan.routes.ts`, find the return endpoint (`/:id/return`). After the reservation activation logic (around line 258), BEFORE `writeAudit`, add the auto-block check:

```typescript
    // Auto-block check: if reader has 2+ overdue loans, block automatically
    const overdueCount = await prisma.loan.count({
      where: { readerId: loan.readerId, status: 'OVERDUE' },
    });
    if (overdueCount >= 2) {
      const reader = await prisma.reader.findUnique({ where: { id: loan.readerId } });
      if (reader && reader.status === 'ACTIVE') {
        await prisma.reader.update({
          where: { id: loan.readerId },
          data: {
            status: 'BLOCKED',
            blockCategory: 'ATRASO_REPETIDO',
            blockReason: 'Bloqueado automaticamente por atrasos repetidos',
            blockedAt: new Date(),
            blockedBy: null,
          },
        });
        await prisma.reservation.updateMany({
          where: { readerId: loan.readerId, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        await writeAudit(null, 'READER_STATUS_CHANGED', 'Reader', loan.readerId, {
          status: 'BLOCKED',
          reason: 'Bloqueado automaticamente por atrasos repetidos',
          category: 'ATRASO_REPETIDO',
          auto: true,
        }, req.ip);
      }
    }
```

- [ ] **Step 2: Verify typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/loan.routes.ts
git commit -m "feat(blocklist): auto-block readers with 2+ overdue loans on return"
```
