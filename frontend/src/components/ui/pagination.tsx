import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const pages = pageRange(page, totalPages);
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <p className="text-[13px] text-muted">
        Página <span className="font-semibold text-ink">{page}</span> de {totalPages}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="icon-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'flex h-8 min-w-8 items-center justify-center rounded-small px-2 text-[13px] font-semibold transition-colors duration-150',
                p === page
                  ? 'bg-primary text-white shadow-card'
                  : 'text-muted hover:bg-canvas hover:text-ink',
              )}
            >
              {p}
            </button>
          ),
        )}
        <Button
          variant="secondary"
          size="icon-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function pageRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}
