import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { Pagination } from '../../components/ui/pagination';
import { NativeSelect } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { TD, TH, TBody, THead, TR, Table } from '../../components/ui/table';
import { auditApi } from '../../features/api';
import { useAsyncData } from '../../features/hooks/use-async-data';
import { formatDateTime } from '../../lib/format';

const ACTIONS_OPTIONS = [
  { value: 'all', label: 'Todas as ações' },
  { value: 'login', label: 'Logins' },
  { value: 'create', label: 'Criações' },
  { value: 'update', label: 'Atualizações' },
  { value: 'delete', label: 'Exclusões' },
  { value: 'block', label: 'Bloqueios' },
  { value: 'return', label: 'Devoluções' },
  { value: 'renew', label: 'Renovações' },
];

export function AuditPage() {
  const [action, setAction] = useState('all');
  const [page, setPage] = useState(1);

  const fetcher = () =>
    auditApi.list({ action: action !== 'all' ? action : undefined, page, pageSize: 20 });
  const { data, error, loading } = useAsyncData(fetcher, [action, page]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trilha de auditoria"
        description={`${data?.total ?? 0} eventos registrados no sistema`}
      />
      <p className="flex items-center gap-2 rounded-card bg-surfaceBlue2 px-4 py-3 text-[13px] text-primary-dark">
        <ScrollText className="size-4" />
        Todas as operações sensíveis (logins, empréstimos, devoluções, alterações) ficam registradas
        com autor, data e IP.
      </p>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <NativeSelect value={action} onChange={setAction} options={ACTIONS_OPTIONS} className="lg:w-48" />
      </div>

      {error ? (
        <Card variant="soft" className="py-12 text-center">
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </Card>
      ) : loading ? (
        <Card className="p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="mb-2.5 h-9" />
          ))}
        </Card>
      ) : data && data.items.length === 0 ? (
        <Card variant="soft">
          <EmptyState title="Nenhum evento encontrado" />
        </Card>
      ) : (
        data && (
          <>
            <Card className="overflow-hidden p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Data</TH>
                    <TH>Usuário</TH>
                    <TH>Ação</TH>
                    <TH>Entidade</TH>
                    <TH>Detalhes</TH>
                    <TH>IP</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((a) => (
                    <TR key={a.id}>
                      <TD className="whitespace-nowrap font-mono text-[12px] text-muted">
                        {formatDateTime(a.createdAt)}
                      </TD>
                      <TD>
                        <span className="line-clamp-1 max-w-44 font-semibold text-ink">
                          {a.user?.name ?? 'Sistema'}
                        </span>
                        {a.user?.email && (
                          <span className="block font-mono text-[11px] text-muted">{a.user.email}</span>
                        )}
                      </TD>
                      <TD>
                        <Badge variant="primary" className="font-mono">
                          {a.action}
                        </Badge>
                      </TD>
                      <TD>
                        <span className="text-[13px] text-ink/85">
                          {a.entity ? `${a.entity}${a.entityId ? ` #${a.entityId}` : ''}` : '—'}
                        </span>
                      </TD>
                      <TD className="max-w-72">
                        <span className="block truncate text-[12.5px] text-muted" title={a.metadata ?? undefined}>
                          {a.metadata ?? '—'}
                        </span>
                      </TD>
                      <TD className="font-mono text-[12px] text-muted">{a.ip ?? '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
            <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
          </>
        )
      )}
    </div>
  );
}