# BlockList Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a dedicated BlockList page with block reason, auto-blocking after 2 overdue loans, and batch unblock.

**Architecture:** Add Prisma fields to Reader for block metadata, new `GET /readers/blocked` endpoint, modify `PATCH /readers/:id/status` to accept reason/category, add auto-block logic in loan return, new frontend page with table/checkboxes/batch actions.

**Tech Stack:** Prisma 5, Express, Zod, React, TypeScript, Tailwind, Radix UI, Lucide React

## Global Constraints

- SQLite database (`backend/prisma/dev.db`)
- JWT auth with `requireAuth` middleware
- RBAC: ADMIN (full access), ATTENDANT (read + manual block, no unblock)
- Audit via `writeAudit()` for all status changes
- Zod validation via `parse()` helper
- UI follows existing patterns: `PageHeader`, `Card`, `Table`, `ConfirmDialog`, `EmptyState`, `Pagination`, `NativeSelect`
- Anti-mock policy: no mock data, real API only

---

## File Structure

### New files
- `frontend/src/pages/admin/blocklist.tsx` — BlockList page (table, search, batch unblock)

### Modified files
- `backend/prisma/schema.prisma` — add block fields to Reader, relation to User
- `backend/src/modules/reader.routes.ts` — new `GET /blocked`, modify `PATCH /:id/status`
- `backend/src/modules/loan.routes.ts` — auto-block logic in return endpoint
- `backend/src/validation.ts` — update `readerStatusSchema` to accept reason/category
- `frontend/src/components/layout/admin-layout.tsx` — add BlockList nav item
- `frontend/src/app/router/routes.tsx` — add route
- `frontend/src/features/api.ts` — add blocked/block/unblockBatch methods
- `frontend/src/types/api.ts` — add `BlockedReader` type
- `frontend/src/pages/admin/reader-details.tsx` — add reason/category to block modal

---

### Task 1: Schema — Add block fields to Reader

**Files:**
- Modify: `backend/prisma/schema.prisma:23-41` (Reader model)
- Modify: `backend/prisma/schema.prisma:10-21` (User model)

**Interfaces:**
- Produces: Reader model with `blockReason`, `blockCategory`, `blockedAt`, `blockedBy` fields; User model with `blockedReaders` relation

- [ ] **Step 1: Add fields to Reader model**

In `backend/prisma/schema.prisma`, add after `status` field in Reader model:

```prisma
model Reader {
  id             Int            @id @default(autoincrement())
  name           String
  cpf            String         @unique
  birthDate      DateTime?
  phone          String?
  email          String?
  cep            String?
  address        String?
  number         String?
  neighborhood   String?
  city           String?
  state          String?
  status         String         @default("ACTIVE")
  blockReason    String?
  blockCategory  String?
  blockedAt      DateTime?
  blockedBy      Int?
  blockedByUser  User?          @relation("BlockedReaders", fields: [blockedBy], references: [id])
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  loans          Loan[]
  reservations   Reservation[]
}
```

- [ ] **Step 2: Add relation to User model**

In `backend/prisma/schema.prisma`, add `blockedReaders` field to User model:

```prisma
model User {
  id             Int        @id @default(autoincrement())
  name           String
  email          String     @unique
  passwordHash   String
  role           String     @default("ATTENDANT")
  status         String     @default("ACTIVE")
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  loans          Loan[]
  logs           AuditLog[]
  blockedReaders Reader[]
}
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
git commit -m "feat(blocklist): add block fields to Reader schema"
```

---

### Task 2: Validation — Update readerStatusSchema

**Files:**
- Modify: `backend/src/validation.ts` (readerStatusSchema)

**Interfaces:**
- Produces: `readerStatusSchema` that accepts optional `reason` and `category` fields

- [ ] **Step 1: Update readerStatusSchema**

In `backend/src/validation.ts`, replace the existing `readerStatusSchema`:

```typescript
export const readerStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']),
  reason: z.string().max(500).optional(),
  category: z.enum(['ATRASO_REPETIDO', 'COMPORTAMENTO', 'SOLICITACAO', 'OUTRO']).optional(),
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/validation.ts
git commit -m "feat(blocklist): extend readerStatusSchema with reason and category"
```

---

### Task 3: Backend — New GET /readers/blocked endpoint

**Files:**
- Modify: `backend/src/modules/reader.routes.ts` (add new endpoint before `/:id`)

**Interfaces:**
- Consumes: Reader model with block fields (Task 1)
- Produces: `GET /api/readers/blocked` endpoint returning paginated blocked readers

- [ ] **Step 1: Add blocked endpoint**

In `backend/src/modules/reader.routes.ts`, add BEFORE the `/:id` route (line 85):

```typescript
readerRouter.get(
  '/blocked',
  asyncHandler(async (req, res) => {
    const q = parse(paginationSchema, req.query);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const where = {
      status: 'BLOCKED' as const,
      ...(search
        ? { OR: [{ name: { contains: search } }, { cpf: { contains: search } }] }
        : {}),
    };
    const total = await prisma.reader.count({ where });
    const items = await prisma.reader.findMany({
      where,
      orderBy: { blockedAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    const ids = items.map((i) => i.id);
    const activeByReader: Record<number, number> = {};
    if (ids.length > 0) {
      const rows = await prisma.loan.groupBy({
        by: ['readerId'],
        where: { readerId: { in: ids }, status: { in: ['ACTIVE', 'OVERDUE'] } },
        _count: { _all: true },
      });
      for (const row of rows) activeByReader[row.readerId] = row._count._all;
    }
    const blockedByNameMap: Record<number, string> = {};
    const userIds = items.filter((i) => i.blockedBy).map((i) => i.blockedBy!);
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: [...new Set(userIds)] } },
        select: { id: true, name: true },
      });
      for (const u of users) blockedByNameMap[u.id] = u.name;
    }
    res.json({
      items: items.map((r) => ({
        ...r,
        activeLoans: activeByReader[r.id] ?? 0,
        blockedByName: r.blockedBy ? blockedByNameMap[r.blockedBy] ?? null : null,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    }
    );
  }),
);
```

- [ ] **Step 2: Add paginationSchema import**

In `backend/src/modules/reader.routes.ts`, add `paginationSchema` to the import from validation:

```typescript
import { cleanNull, dateOrNull, parse, paginationSchema, readerQuerySchema, readerSchema, readerStatusSchema, readerUpdateSchema } from '../validation';
```

- [ ] **Step 3: Verify typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/reader.routes.ts
git commit -m "feat(blocklist): add GET /readers/blocked endpoint"
```

---

### Task 4: Backend — Modify PATCH /readers/:id/status with reason

**Files:**
- Modify: `backend/src/modules/reader.routes.ts:148-159` (PATCH /:id/status)

**Interfaces:**
- Consumes: Updated `readerStatusSchema` (Task 2)
- Produces: PATCH endpoint that stores/clears block metadata

- [ ] **Step 1: Update PATCH /:id/status handler**

Replace the existing PATCH handler in `backend/src/modules/reader.routes.ts`:

```typescript
readerRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { status, reason, category } = parse(readerStatusSchema, req.body);
    const existing = await prisma.reader.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Leitor não encontrado');
    const data: Record<string, unknown> = { status };
    if (status === 'BLOCKED') {
      data.blockReason = reason ?? null;
      data.blockCategory = category ?? null;
      data.blockedAt = new Date();
      data.blockedBy = req.user!.id;
    } else if (status === 'ACTIVE') {
      data.blockReason = null;
      data.blockCategory = null;
      data.blockedAt = null;
      data.blockedBy = null;
    }
    const reader = await prisma.reader.update({ where: { id }, data });
    await writeAudit(req.user?.id, 'READER_STATUS_CHANGED', 'Reader', id, {
      status,
      reason: reason ?? null,
      category: category ?? null,
    }, req.ip);
    res.json(reader);
  }),
);
```

- [ ] **Step 2: Verify typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/reader.routes.ts
git commit -m "feat(blocklist): PATCH /readers/:id/status stores block reason"
```

---

### Task 5: Backend — Auto-block after 2 overdue loans

**Files:**
- Modify: `backend/src/modules/loan.routes.ts:235-263` (POST /:id/return)

**Interfaces:**
- Consumes: Reader model with block fields (Task 1)
- Produces: Auto-block logic triggered on loan return

- [ ] **Step 1: Add auto-block check after return**

In `backend/src/modules/loan.routes.ts`, find the return endpoint (`/:id/return`). After the reservation activation logic (line 258), BEFORE `writeAudit`, add the auto-block check:

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

---

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

---

### Task 7: Frontend — Add BlockList route and nav item

**Files:**
- Modify: `frontend/src/app/router/routes.tsx` (add route)
- Modify: `frontend/src/components/layout/admin-layout.tsx` (add nav item)

**Interfaces:**
- Produces: `/admin/blocklist` route, sidebar item in Comunidade section

- [ ] **Step 1: Add route**

In `frontend/src/app/router/routes.tsx`, add inside `<RequireAuth>` but outside `<RequireAdmin>`, after the `admin/leitores/:id` route:

```tsx
import { BlockListPage } from '../../pages/admin/blocklist';
```

And add the route:

```tsx
<Route path="admin/blocklist" element={<BlockListPage />} />
```

- [ ] **Step 2: Add nav item to sidebar**

In `frontend/src/components/layout/admin-layout.tsx`, add `Ban` to the lucide-react import:

```typescript
import { Ban, BarChart3, BookMarked, /* ...rest */ } from 'lucide-react';
```

Add item to the Comunidade section, after Leitores:

```typescript
{
  label: 'Comunidade',
  items: [
    { to: '/admin/leitores', label: 'Leitores', icon: Users, adminOnly: false },
    { to: '/admin/blocklist', label: 'BlockList', icon: Ban, adminOnly: false },
    // ...rest unchanged
  ],
},
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds (BlockListPage import will fail until Task 8, so create a placeholder first)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/router/routes.tsx frontend/src/components/layout/admin-layout.tsx
git commit -m "feat(blocklist): add route and sidebar nav item"
```

---

### Task 8: Frontend — BlockList page

**Files:**
- Create: `frontend/src/pages/admin/blocklist.tsx`

**Interfaces:**
- Consumes: `readersApi.blocked()`, `readersApi.unblock()`, `readersApi.unblockBatch()`, `BlockedReader` type
- Produces: Complete BlockList page with table, search, checkboxes, batch unblock

- [ ] **Step 1: Create BlockList page**

Create `frontend/src/pages/admin/blocklist.tsx`:

```tsx
import { useSearchParams } from 'react-router-dom';
import { Ban, CheckCircle2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { Pagination } from '../../components/ui/pagination';
import { Skeleton } from '../../components/ui/skeleton';
import { TD, TH, TBody, THead, TR, Table } from '../../components/ui/table';
import { readersApi } from '../../features/api';
import { useAuth } from '../../features/auth/auth-provider';
import { useDebounce } from '../../features/hooks/use-debounce';
import { useToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';
import { formatCPF, formatDate } from '../../lib/format';
import type { BlockedReader, Paginated } from '../../types/api';

const CATEGORY_LABELS: Record<string, string> = {
  ATRASO_REPETIDO: 'Atraso repetido',
  COMPORTAMENTO: 'Comportamento',
  SOLICITACAO: 'Solicitação',
  OUTRO: 'Outro',
};

export function BlockListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? '1');
  const [input, setInput] = useState(q);
  const debounced = useDebounce(input, 350);
  const [data, setData] = useState<Paginated<BlockedReader> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState<'none' | 'single' | 'batch'>('none');
  const [targetId, setTargetId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setInput(q);
  }, [q]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    readersApi
      .blocked({ search: debounced || undefined, page, pageSize: 10 })
      .then(setData)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [debounced, page]);

  const syncSearch = (value: string) => {
    setInput(value);
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    next.delete('page');
    setParams(next);
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (selected.size === data.items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.items.map((i) => i.id)));
    }
  };

  const handleUnblock = async (ids: number[]) => {
    setBusy(true);
    try {
      await readersApi.unblockBatch(ids);
      toast.success(ids.length === 1 ? 'Leitor desbloqueado' : `${ids.length} leitores desbloqueados`);
      setSelected(new Set());
      setConfirming('none');
      setLoading(true);
      readersApi
        .blocked({ search: debounced || undefined, page, pageSize: 10 })
        .then(setData)
        .catch((err) => setError(apiErrorMessage(err)))
        .finally(() => setLoading(false));
    } catch (err) {
      toast.error('Não foi possível concluir', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="BlockList"
        description={`${data?.total ?? 0} leitor(es) bloqueado(s)`}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={input}
          onChange={(e) => syncSearch(e.target.value)}
          placeholder="Buscar por nome ou CPF..."
          className="h-10 w-full rounded-control bg-surface pl-10 pr-3 text-sm text-ink shadow-[inset_0_0_0_1px_rgba(23,26,26,.1)] focus:outline-none focus:shadow-[inset_0_0_0_2px_#087F8C]"
        />
      </div>

      {isAdmin && selected.size > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{selected.size} selecionado(s)</span>
          <Button variant="secondary" size="sm" onClick={() => setConfirming('batch')}>
            <CheckCircle2 className="size-4 text-success" /> Desbloquear selecionados
          </Button>
        </div>
      )}

      {error ? (
        <Card variant="soft" className="py-12 text-center">
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </Card>
      ) : loading ? (
        <Card className="p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-14" />
          ))}
        </Card>
      ) : data && data.items.length === 0 ? (
        <Card variant="soft">
          <EmptyState
            title="Nenhum leitor bloqueado"
            description="Todos os leitors estão com status ativo."
          />
        </Card>
      ) : (
        data && (
          <>
            <Card className="overflow-hidden p-0">
              <Table>
                <THead>
                  <TR>
                    {isAdmin && (
                      <TH>
                        <input
                          type="checkbox"
                          checked={selected.size === data.items.length && data.items.length > 0}
                          onChange={toggleSelectAll}
                          className="size-4 rounded border-muted text-primary focus:ring-primary"
                        />
                      </TH>
                    )}
                    <TH>Nome</TH>
                    <TH>CPF</TH>
                    <TH>Bloqueado em</TH>
                    <TH>Motivo</TH>
                    <TH>Bloqueado por</TH>
                    <TH className="text-right">Ações</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((r) => (
                    <TR key={r.id}>
                      {isAdmin && (
                        <TD>
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onChange={() => toggleSelect(r.id)}
                            className="size-4 rounded border-muted text-primary focus:ring-primary"
                          />
                        </TD>
                      )}
                      <TD className="font-semibold text-ink">{r.name}</TD>
                      <TD className="font-mono text-[12px] text-muted">{formatCPF(r.cpf)}</TD>
                      <TD className="text-muted">{r.blockedAt ? formatDate(r.blockedAt) : '—'}</TD>
                      <TD>
                        {r.blockCategory ? (
                          <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive">
                            {CATEGORY_LABELS[r.blockCategory] ?? r.blockCategory}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TD>
                      <TD className="text-muted">{r.blockedByName ?? 'Sistema'}</TD>
                      <TD className="text-right">
                        {isAdmin && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => { setTargetId(r.id); setConfirming('single'); }}
                          >
                            <CheckCircle2 className="size-4 text-success" /> Desbloquear
                          </Button>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
            <Pagination
              page={page}
              totalPages={data.totalPages}
              onPageChange={(p) => {
                const next = new URLSearchParams(params);
                if (p > 1) next.set('page', String(p));
                else next.delete('page');
                setParams(next);
              }}
            />
          </>
        )
      )}

      <ConfirmDialog
        open={confirming !== 'none'}
        onOpenChange={(o) => !o && setConfirming('none')}
        title="Desbloquear leitor"
        description={
          confirming === 'batch'
            ? `${selected.size} leitor(es) poderão realizar empréstimos novamente.`
            : 'Este leitor poderá realizar empréstimos novamente.'
        }
        confirmLabel="Desbloquear"
        loading={busy}
        onConfirm={() => {
          if (confirming === 'batch') handleUnblock(Array.from(selected));
          else if (targetId) handleUnblock([targetId]);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/admin/blocklist.tsx
git commit -m "feat(blocklist): add BlockList page with search, checkboxes, batch unblock"
```

---

### Task 9: Frontend — Update reader-details block modal with reason

**Files:**
- Modify: `frontend/src/components/ui/confirm-dialog.tsx:6-26` (add children prop)
- Modify: `frontend/src/pages/admin/reader-details.tsx:22-23,41-50,197-210` (state, toggleBlock, ConfirmDialog)

**Interfaces:**
- Consumes: Updated `readersApi.block()` with reason/category (Task 6)
- Produces: Block modal with reason selection and detail text

- [ ] **Step 1: Add children support to ConfirmDialog**

In `frontend/src/components/ui/confirm-dialog.tsx`, update the import and function signature:

```typescript
import { type ReactNode, useState } from 'react';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive,
  loading,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}) {
```

And add `{children}` between `<DialogHeader>` and the button div:

```tsx
      <DialogContent className="max-w-md">
        <DialogHeader title={title} description={description} />
        {children}
        <div className="flex items-center justify-end gap-2">
```

- [ ] **Step 2: Add state for block reason in reader-details**

In `frontend/src/pages/admin/reader-details.tsx`, add two new state variables after the existing state declarations (line 22-23):

```typescript
const [blockCategory, setBlockCategory] = useState<string>('ATRASO_REPETIDO');
const [blockReason, setBlockReason] = useState('');
```

- [ ] **Step 3: Update toggleBlock function**

Replace the `toggleBlock` function (lines 41-50):

```typescript
const toggleBlock = async () => {
  setBusy(true);
  try {
    if (reader.status === 'BLOCKED') await readersApi.unblock(reader.id);
    else await readersApi.block(reader.id, blockReason || undefined, blockCategory || undefined);
    toast.success(reader.status === 'BLOCKED' ? 'Leitor desbloqueado' : 'Leitor bloqueado');
    setConfirming({ kind: 'none' });
    setBlockReason('');
    setBlockCategory('ATRASO_REPETIDO');
    refetch();
  } catch (err) {
    toast.error('Não foi possível concluir', apiErrorMessage(err));
  } finally {
    setBusy(false);
  }
};
```

- [ ] **Step 4: Update ConfirmDialog for block**

Replace the ConfirmDialog section (lines 197-210):

```tsx
<ConfirmDialog
  open={confirming.kind !== 'none'}
  onOpenChange={(o) => !o && setConfirming({ kind: 'none' })}
  title={confirming.kind === 'block' ? 'Bloquear leitor' : 'Desbloquear leitor'}
  description={
    confirming.kind === 'block'
      ? `${reader.name} não poderá realizar novos empréstimos até ser desbloqueado.`
      : `${reader.name} voltará a poder realizar empréstimos.`
  }
  confirmLabel={confirming.kind === 'block' ? 'Bloquear' : 'Desbloquear'}
  destructive={confirming.kind === 'block'}
  loading={busy}
  onConfirm={toggleBlock}
>
  {confirming.kind === 'block' && (
    <div className="space-y-3 py-2">
      <div>
        <label className="mb-1 block text-[12px] font-bold text-muted">Motivo</label>
        <select
          value={blockCategory}
          onChange={(e) => setBlockCategory(e.target.value)}
          className="h-9 w-full rounded-control bg-surface px-3 text-sm text-ink shadow-[inset_0_0_0_1px_rgba(23,26,26,.1)]"
        >
          <option value="ATRASO_REPETIDO">Atraso repetido</option>
          <option value="COMPORTAMENTO">Comportamento inadequado</option>
          <option value="SOLICITACAO">Solicitação administrativa</option>
          <option value="OUTRO">Outro</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[12px] font-bold text-muted">Detalhes (opcional)</label>
        <textarea
          value={blockReason}
          onChange={(e) => setBlockReason(e.target.value)}
          placeholder="Descreva o motivo do bloqueio..."
          rows={3}
          className="w-full rounded-control bg-surface px-3 py-2 text-sm text-ink shadow-[inset_0_0_0_1px_rgba(23,26,26,.1)] focus:outline-none focus:shadow-[inset_0_0_0_2px_#087F8C]"
        />
      </div>
    </div>
  )}
</ConfirmDialog>
```

- [ ] **Step 5: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/confirm-dialog.tsx frontend/src/pages/admin/reader-details.tsx
git commit -m "feat(blocklist): add reason/category fields to block modal"
```

---

### Task 10: Final verification and smoke test

**Files:**
- None (verification only)

- [ ] **Step 1: Full backend typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Full frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Start backend and verify endpoint**

Run: `cd backend && npm run dev`
Then: `curl http://localhost:3333/api/readers/blocked`
Expected: `{"items":[],"total":0,"page":1,"pageSize":10,"totalPages":0}`

- [ ] **Step 4: Run smoke tests**

Run: `cd backend && npm run smoke`
Expected: All 58 tests pass (existing + new blocklist tests)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(blocklist): complete BlockList module"
```
