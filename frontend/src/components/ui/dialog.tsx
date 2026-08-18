import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay() {
  return (
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] anim-fade" />
  );
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  hideClose?: boolean;
}

export function DialogContent({ children, className, size = 'md', hideClose }: DialogContentProps) {
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' };
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
          'rounded-shell bg-surface p-1 shadow-pop anim-pop',
          'max-h-[90vh] overflow-y-auto',
          widths[size],
          className,
        )}
      >
        <div className="rounded-[15px] bg-surface p-5 sm:p-6">
          {children}
          {!hideClose && (
            <DialogPrimitive.Close asChild>
              <button
                className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-canvas hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </DialogPrimitive.Close>
          )}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 pr-8">
      <DialogPrimitive.Title className="text-lg font-extrabold tracking-tight text-ink">
        {title}
      </DialogPrimitive.Title>
      {description && <DialogPrimitive.Description className="mt-1 text-[13px] text-muted" />}
    </div>
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex flex-wrap items-center justify-end gap-2', className)}
      {...props}
    />
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-4', className)} {...props} />;
}

export const DialogTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-extrabold tracking-tight text-ink', className)}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';
