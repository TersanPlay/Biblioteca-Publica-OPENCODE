import { Link, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Search } from 'lucide-react';
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
import { LoanStatusBadge } from '../../components/ui/status-badge';
import { TD, TH, TBody, THead, TR, Table } from '../../components/ui/table';
import { loansApi } from '../../features/api';
import { useAsyncData } from '../../features/hooks/use-async-data';
import { useDebounce } from '../../features/hooks/use-debounce';
import { useApiToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import type { Loan } from '../../types/api';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'OVERDUE', label: 'Atrasados' },
  { value: 'RETURNED', label: 'Devolvidos' },
];

export function LoansPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? 'all';
  const page = Number(params.get('page') ?? '1');
  const [input, setInput] = useState(q);
  const debounced = useDebounce(input, 350);
  const [renewing, setRenewing] = useState<Loan | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useApiToast();

  const fetcher = () =>
    loansApi.list({ search: debounced || undefined, status: status !== 'all' ? status : undefined, page, pageSize: 12 });
  const { data, error, loading, refetch } = useAsyncData(fetcher, [debounced, status, page]);

  const confirmRenew = async () => {
    if (!renewing) return;
    setBusy(true);
    try {
      await loansApi.renew(renewing.$id);
      toast.success('Empréstimo renovado', 'Nova data de vencimento aplicada.');
      setRenewing(null);
      refetch();
    } catch (err) {
      toast.error('Não foi possível renovar', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Empréstimos"
        description={`${data?.total ?? 0} registros de balcão`}
        actions={
          <Link to="/admin/emprestimos/novo">
            <Button><Plus className="size-4" /> Novo empréstimo</Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Buscar por leitor, livro ou número..."
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
          className="lg:w-48"
        />
      </div>

      {error ? (
        <Card variant="soft" className="py-12 text-center">
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </Card>
      ) : loading ? (
        <Card className="p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-12" />
          ))}
        </Card>
      ) : data && data.items.length === 0 ? (
        <Card variant="soft">
          <EmptyState
            title="Nenhum empréstimo encontrado"
            action={
              <Link to="/admin/emprestimos/novo">
                <Button size="sm">Registrar empréstimo</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        data && (
          <>
            <Card className="overflow-hidden p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>#</TH>
                    <TH>Leitor</TH>
                    <TH>Livro</TH>
                    <TH>Saída</TH>
                    <TH>Vencimento</TH>
                    <TH>Renovações</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Ações</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((l) => {
                    const overdue = l.status === 'OVERDUE';
                    return (
                      <TR key={l.$id}>
                        <TD className="font-mono text-[12px] text-muted">
                          {l.number ?? `#${l.$id}`}
                        </TD>
                        <TD>
                          <Link
                            to={`/admin/leitores/${l.readerId}`}
                            className="line-clamp-1 max-w-44 font-semibold text-ink hover:text-primary"
                          >
                            {l.readerNameSnapshot}
                          </Link>
                        </TD>
                        <TD className="max-w-60">
                          <span className="block line-clamp-1 font-medium text-ink/85">
                            {l.bookTitleSnapshot}
                          </span>
                        </TD>
                        <TD className="text-muted">{formatDate(l.loanDate)}</TD>
                        <TD>
                          <Badge variant={overdue ? 'destructive' : 'neutral'}>{formatDate(l.dueDate)}</Badge>
                        </TD>
                        <TD className="font-mono text-[12.5px] text-muted">{l.renewals}</TD>
                        <TD>
                          <LoanStatusBadge status={l.status} />
                        </TD>
                        <TD className="text-right">
                          {l.status !== 'RETURNED' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={overdue || busy}
                              title={undefined}
                              onClick={() => setRenewing(l)}
                            >
                              <RefreshCw className="size-3.5" /> Renovar
                            </Button>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
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
        open={!!renewing}
        onOpenChange={(o) => !o && setRenewing(null)}
        title="Renovar empréstimo"
        description={
          renewing
            ? `Novo vencimento para ${renewing.bookTitleSnapshot} — leitor ${renewing.readerNameSnapshot}.`
            : undefined
        }
        confirmLabel="Renovar"
        loading={busy}
        onConfirm={confirmRenew}
      />
    </div>
  );
}