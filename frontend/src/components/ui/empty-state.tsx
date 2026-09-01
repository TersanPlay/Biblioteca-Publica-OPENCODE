import { Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';

export function EmptyState({
  title,
  description,
  action,
  className,
  compact,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 text-center',
        compact ? 'py-10' : 'py-16',
        className,
      )}
    >
      <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-surfaceBlue text-primary">
        <Inbox className="size-5" />
      </div>
      <p className="text-[15px] font-bold text-ink">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
