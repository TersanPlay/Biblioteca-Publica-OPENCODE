import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '../../lib/utils';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  children,
  className,
  align = 'end',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'end' | 'center';
}) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-44 rounded-card border border-black/5 bg-surface p-1.5 shadow-pop anim-pop',
          className,
        )}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  children,
  className,
  destructive,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-control px-3 py-2 text-[13px] font-medium text-ink outline-none',
        'transition-colors duration-150 data-[highlighted]:bg-surfaceBlue data-[highlighted]:text-primary-dark',
        destructive && 'text-destructive data-[highlighted]:bg-destructive-soft data-[highlighted]:text-destructive',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownMenuSeparator() {
  return <DropdownMenuPrimitive.Separator className="my-1.5 h-px bg-black/8" />;
}

export function DropdownMenuLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted', className)}
    >
      {children}
    </DropdownMenuPrimitive.Label>
  );
}
