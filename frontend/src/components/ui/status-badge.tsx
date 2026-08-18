import { cn } from '../../lib/utils';
import type { LoanStatus, ReaderStatus, ReservationStatus, Status } from '../../types/api';
import { Badge } from './badge';

const statusMap: Record<
  string,
  { label: string; variant: 'neutral' | 'primary' | 'success' | 'warning' | 'destructive' | 'gold' }
> = {
  ACTIVE: { label: 'Ativo', variant: 'success' },
  AVAILABLE: { label: 'Disponível', variant: 'primary' },
  INACTIVE: { label: 'Inativo', variant: 'neutral' },
  BLOCKED: { label: 'Bloqueado', variant: 'destructive' },
  OVERDUE: { label: 'Atrasado', variant: 'destructive' },
  RETURNED: { label: 'Devolvido', variant: 'neutral' },
  PENDING: { label: 'Pendente', variant: 'warning' },
  FULFILLED: { label: 'Atendida', variant: 'success' },
  CANCELLED: { label: 'Cancelada', variant: 'neutral' },
  EXPIRED: { label: 'Expirada', variant: 'neutral' },
};

function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = statusMap[status] ?? { label: status, variant: 'neutral' as const };
  return (
    <Badge variant={cfg.variant} dot className={cn('whitespace-nowrap', className)}>
      {cfg.label}
    </Badge>
  );
}

export function UserStatusBadge({ status }: { status: Status }) {
  return <StatusBadge status={status} />;
}

export function ReaderStatusBadge({ status }: { status: ReaderStatus }) {
  return <StatusBadge status={status} />;
}

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return <StatusBadge status={status} />;
}

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return <StatusBadge status={status} />;
}
