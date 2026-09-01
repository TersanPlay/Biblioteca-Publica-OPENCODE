import * as DialogPrimitive from '@radix-ui/react-dialog';
import { type ReactNode, useState } from 'react';
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
  confirmDisabled,
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
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const isBusy = busy || loading;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader title={title} description={description} />
        {children}
        <div className="flex items-center justify-end gap-2">
          <DialogPrimitive.Close asChild>
            <Button variant="secondary" disabled={isBusy}>
              {cancelLabel}
            </Button>
          </DialogPrimitive.Close>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            loading={isBusy}
            disabled={confirmDisabled}
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
