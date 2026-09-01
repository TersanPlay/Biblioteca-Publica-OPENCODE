### Task 6: Frontend — Add types and API methods

**Files:**
- Modify: `frontend/src/types/api.ts` (add BlockedReader)
- Modify: `frontend/src/features/api.ts` (add blocked, block, unblockBatch)

**Interfaces:**
- Produces: `BlockedReader` type, `readersApi.blocked()`, updated `readersApi.block()` with reason/category, `readersApi.unblockBatch()`

- [ ] **Step 1: Add BlockedReader type**

In `frontend/src/types/api.ts`, add after the `Reader` interface:

```typescript
export interface BlockedReader extends Reader {
  blockReason: string | null;
  blockCategory: string | null;
  blockedAt: string | null;
  blockedByName: string | null;
}
```

- [ ] **Step 2: Add API methods**

In `frontend/src/features/api.ts`, update the `readersApi` object:

```typescript
export const readersApi = {
  list: (params?: Params) => api.get<Paginated<Reader>>('/readers', { params }).then((r) => r.data),
  get: (id: number) => api.get<ReaderDetail>(`/readers/${id}`).then((r) => r.data),
  create: (v: Record<string, unknown>) =>
    api.post<Reader>('/readers', cleanPayload(v)).then((r) => r.data),
  update: (id: number, v: Record<string, unknown>) =>
    api.put<Reader>(`/readers/${id}`, cleanPayload(v)).then((r) => r.data),
  block: (id: number, reason?: string, category?: string) =>
    api.patch<Reader>(`/readers/${id}/status`, { status: 'BLOCKED', reason, category }).then((r) => r.data),
  unblock: (id: number) =>
    api.patch<Reader>(`/readers/${id}/status`, { status: 'ACTIVE' }).then((r) => r.data),
  unblockBatch: (ids: number[]) =>
    Promise.all(ids.map((id) => api.patch(`/readers/${id}/status`, { status: 'ACTIVE' }))),
  blocked: (params?: Params) =>
    api.get<Paginated<BlockedReader>>('/readers/blocked', { params }).then((r) => r.data),
};
```

- [ ] **Step 3: Add import for BlockedReader**

In `frontend/src/features/api.ts`, add `BlockedReader` to the import from types:

```typescript
import type {
  Author,
  AuditLog,
  Backup,
  BlockedReader,
  Book,
  // ...rest unchanged
} from '../types/api';
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/features/api.ts
git commit -m "feat(blocklist): add BlockedReader type and API methods"
```
