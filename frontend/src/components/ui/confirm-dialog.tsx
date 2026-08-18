import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useState } from 'react';
import { Button } from './button';
import { Dialog, DialogContent, DialogHeader } from './dialog';

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
}) {
  const [busy, setBusy] = useState(false);
  const isBusy = busy || loading;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader title={title} description={description} />
        <div className="flex items-center justify-end gap-2">
          <DialogPrimitive.Close asChild>
            <Button variant="secondary" disabled={isBusy}>
              {cancelLabel}
            </Button>
          </DialogPrimitive.Close>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            loading={isBusy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
