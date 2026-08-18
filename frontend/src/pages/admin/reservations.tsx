import { useSearchParams } from 'react-router-dom';
import { BookOpen, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { Pagination } from '../../components/ui/pagination';
import { NativeSelect } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { ReservationStatusBadge } from '../../components/ui/status-badge';
import { TD, TH, TBody, THead, TR, Table } from '../../components/ui/table';
import { reservationsApi } from '../../features/api';
import { useAsyncData } from '../../features/hooks/use-async-data';
import { useDebounce } from '../../features/hooks/use-debounce';
import { useApiToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';
import { formatDate, formatDateTime } from '../../lib/format';
import type { Reservation } from '../../types/api';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'AVAILABLE', label: 'Disponíveis p/ retirada' },
  { value: 'FULFILLED', label: 'Atendidas' },
  { value: 'CANCELLED', label: 'Canceladas' },
  { value: 'EXPIRED', label: 'Expiradas' },
];

export function ReservationsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? 'all';
  const page = Number(params.get('page') ?? '1');
  const [input, setInput] = useState(q);
  const debounced = useDebounce(input, 350);
  const [action, setAction] = useState<{ res: Reservation; kind: 'fulfill' | 'cancel' } | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useApiToast();

  const fetcher = () =>
    reservationsApi.list({ search: debounced || undefined, status: status !== 'all' ? status : undefined, page, pageSize: 12 });
  const { data, error, loading, refetch } = useAsyncData(fetcher, [debounced, status, page]);

  const confirmAction = async () => {
    if (!action) return;
    setBusy(true);
    try {
      if (action.kind === 'fulfill') {
        await reservationsApi.fulfill(action.res.id);
        toast.success('Reserva convertida em empréstimo');
      } else {
        await reservationsApi.cancel(action.res.id);
        toast.success('Reserva cancelada');
      }
      setAction(null);
      refetch();
    } catch (err) {
      toast.error('Não foi possível concluir', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reservas"
        description={`${data?.total ?? 0} pedidos da comunidade`}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Buscar por leitor ou livro..."
            className="h-10 w-full rounded-control bg-surface pl-10 pr-3 text-sm text-ink shadow-[inset_0_0_0_1px_rgba(23,26,26,.1)] focus:outline-none focus:shadow-[inset_0_0_0_2px_#087F8C]"
          />
        </div>
        <NativeSelect
          value={status}
          onChange={(v) => {
            const next = new URLSearchParams(params);
            if (v === 'all') next.delete('status');
            else next.set('status', v);
            next.delete('page');
            setParams(next);
          }}
          options={STATUS_OPTIONS}
          className="lg:w-56"
        />
      </div>

      {error ? (
        <Card variant="soft" className="py-12 text-center">
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </Card>
      ) : loading ? (
        <Card className="p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-12" />
          ))}
        </Card>
      ) : data && data.items.length === 0 ? (
        <Card variant="soft">
          <EmptyState
            title="Nenhuma reserva encontrada"
            description="Reservas aparecem quando leitores pedem um livro indisponível."
          />
        </Card>
      ) : (
        data && (
          <>
            <Card className="overflow-hidden p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Leitor</TH>
                    <TH>Livro</TH>
                    <TH>Solicitada em</TH>
                    <TH>Expira</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Ações</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((r) => (
                    <TR key={r.id}>
                      <TD className="max-w-44 truncate font-semibold text-ink">{r.reader?.name}</TD>
                      <TD className="max-w-56">
                        <span className="block line-clamp-1 font-medium text-ink/85">{r.book?.title}</span>
                        <span className="block text-[11px] text-muted">{r.book?.isbn13 ?? r.book?.isbn10 ?? ''}</span>
                      </TD>
                      <TD className="text-muted">{formatDateTime(r.createdAt)}</TD>
                      <TD>
                        {r.expiresAt ? (
                          new Date(r.expiresAt) < new Date() && r.status === 'AVAILABLE' ? (
                            <Badge variant="destructive">{formatDate(r.expiresAt)}</Badge>
                          ) : (
                            <span className="text-muted">{formatDate(r.expiresAt)}</span>
                          )
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TD>
                      <TD><ReservationStatusBadge status={r.status} /></TD>
                      <TD className="text-right">
                        {r.status === 'PENDING' && (
                          <Button variant="ghost" size="sm" onClick={() => setAction({ res: r, kind: 'cancel' })}>
                            <X className="size-4" /> Cancelar
                          </Button>
                        )}
                        {r.status === 'AVAILABLE' && (
                          <Button size="sm" onClick={() => setAction({ res: r, kind: 'fulfill' })}>
                            <BookOpen className="size-4" /> Atender (empréstimo)
                          </Button>
                        )}
                        {(r.status === 'PENDING' || r.status === 'AVAILABLE') && (
                          <Button variant="secondary" size="sm" className="ml-1.5" onClick={() => setAction({ res: r, kind: 'cancel' })}>
                            <X className="size-4" />
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
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
        title={action?.kind === 'fulfill' ? 'Atender reserva' : 'Cancelar reserva'}
        description={
          action
            ? action.kind === 'fulfill'
              ? `Converter a reserva de ${action.res.book?.title} em empréstimo para ${action.res.reader?.name}?`
              : `A reserva de ${action.res.book?.title} por ${action.res.reader?.name} será cancelada.`
            : undefined
        }
        confirmLabel={action?.kind === 'fulfill' ? 'Atender agora' : 'Cancelar reserva'}
        destructive={action?.kind === 'cancel'}
        loading={busy}
        onConfirm={confirmAction}
      />
    </div>
  );
}