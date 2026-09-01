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
