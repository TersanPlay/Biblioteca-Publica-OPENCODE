import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CheckCircle2, Mail, MapPin, Phone, UserRound } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { EmptyState } from '../../components/ui/empty-state';
import { PageSkeleton } from '../../components/ui/skeleton';
import { ReservationStatusBadge, LoanStatusBadge, ReaderStatusBadge } from '../../components/ui/status-badge';
import { TD, TH, THead, TR, Table, TBody } from '../../components/ui/table';
import { readersApi } from '../../features/api';
import { useAsyncData } from '../../features/hooks/use-async-data';
import { useApiToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';
import { formatCPF, formatDate, formatPhone } from '../../lib/format';

export function ReaderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const readerId = Number(id);
  const fetcher = useCallback(() => readersApi.get(readerId), [readerId]);
  const { data, error, loading, refetch } = useAsyncData(fetcher, [readerId]);
  const [confirming, setConfirming] = useState<{ kind: 'none' | 'block' | 'unblock' }>({ kind: 'none' });
  const [busy, setBusy] = useState(false);
  const { toast } = useApiToast();

  if (loading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <Card variant="soft" className="py-14 text-center">
        <p className="text-sm font-semibold text-destructive">{error ?? 'Leitor não encontrado.'}</p>
        <Link to="/admin/leitores">
          <Button variant="secondary" size="sm" className="mt-3">Voltar</Button>
        </Link>
      </Card>
    );
  }

  const { reader } = data;

  const toggleBlock = async () => {
    setBusy(true);
    try {
      if (reader.status === 'BLOCKED') await readersApi.unblock(reader.id);
      else await readersApi.block(reader.id);
      toast.success(reader.status === 'BLOCKED' ? 'Leitor desbloqueado' : 'Leitor bloqueado');
      setConfirming({ kind: 'none' });
      refetch();
    } catch (err) {
      toast.error('Não foi possível concluir', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const contact = [
    { icon: Mail, label: 'E-mail', value: reader.email },
    { icon: Phone, label: 'Telefone', value: reader.phone ? formatPhone(reader.phone) : null },
    { icon: UserRound, label: 'Nascimento', value: reader.birthDate ? formatDate(reader.birthDate) : null },
    { icon: MapPin, label: 'Endereço', value: [reader.address, reader.number, reader.neighborhood, reader.city, reader.state].filter(Boolean).join(', ') || null },
  ].filter((c) => c.value);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/leitores"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary transition-colors hover:text-primary-dark"
        >
          <ArrowLeft className="size-4" /> Leitores
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-shell bg-primary-soft text-xl font-extrabold text-primary-dark">
            {reader.name.split(' ').slice(0, 2).map((p) => p[0]).join('')}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-ink">{reader.name}</h1>
              <ReaderStatusBadge status={reader.status} />
            </div>
            <p className="mt-1 font-mono text-[13px] text-muted">{formatCPF(reader.cpf)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/emprestimos/novo">
              <Button disabled={reader.status !== 'ACTIVE'} title={reader.status !== 'ACTIVE' ? 'Leitor bloqueado ou inativo não pode realizar empréstimos' : undefined}>
                Novo empréstimo
              </Button>
            </Link>
            {reader.status === 'BLOCKED' ? (
              <Button variant="secondary" onClick={() => setConfirming({ kind: 'unblock' })}>
                <CheckCircle2 className="size-4 text-success" /> Desbloquear
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setConfirming({ kind: 'block' })}>
                <Ban className="size-4 text-destructive" /> Bloquear
              </Button>
            )}
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {contact.map((c) => (
            <div key={c.label} className="flex items-center gap-3 rounded-card bg-surfaceBlue2 px-4 py-3">
              <c.icon className="size-4 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-muted">{c.label}</span>
                <span className="block truncate text-[13px] font-semibold text-ink">{c.value}</span>
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-extrabold text-primary">{data.activeLoans.length}</p>
          <p className="mt-0.5 text-[12px] font-semibold text-muted">Empréstimos ativos</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-extrabold text-destructive">{data.overdueCount}</p>
          <p className="mt-0.5 text-[12px] font-semibold text-muted">Em atraso</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-extrabold text-ink">{data.reservations.filter((r) => r.status === 'PENDING').length}</p>
          <p className="mt-0.5 text-[12px] font-semibold text-muted">Reservas pendentes</p>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-black/8 p-5 pb-4">
            <h2 className="text-[15px] font-bold text-ink">Histórico de empréstimos</h2>
          </div>
          {data.loans.length === 0 ? (
            <EmptyState compact title="Nenhum empréstimo ainda" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Livro</TH>
                  <TH>Emprestado em</TH>
                  <TH>Vencimento</TH>
                  <TH>Devolução</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {data.loans.map((l) => (
                  <TR key={l.id}>
                    <TD className="max-w-56 truncate font-semibold text-ink">{l.book?.title}</TD>
                    <TD className="text-muted">{formatDate(l.loanDate)}</TD>
                    <TD className="text-muted">{formatDate(l.dueDate)}</TD>
                    <TD className="text-muted">{l.returnedAt ? formatDate(l.returnedAt) : '—'}</TD>
                    <TD><LoanStatusBadge status={l.status} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-black/8 p-5 pb-4">
            <h2 className="text-[15px] font-bold text-ink">Reservas</h2>
          </div>
          {data.reservations.length === 0 ? (
            <EmptyState compact title="Nenhuma reserva" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Livro</TH>
                  <TH>Solicitada em</TH>
                  <TH>Expira em</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {data.reservations.map((r) => (
                  <TR key={r.id}>
                    <TD className="max-w-56 truncate font-semibold text-ink">{r.book?.title}</TD>
                    <TD className="text-muted">{formatDate(r.createdAt)}</TD>
                    <TD className="text-muted">{r.expiresAt ? formatDate(r.expiresAt) : '—'}</TD>
                    <TD><ReservationStatusBadge status={r.status} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming.kind !== 'none'}
        onOpenChange={(o) => !o && setConfirming({ kind: 'none' })}
        title={confirming.kind === 'block' ? 'Bloquear leitor' : 'Desbloquear leitor'}
        description={
          confirming.kind === 'block'
            ? `${reader.name} não poderá realizar novos empréstimos até ser desbloqueado.`
            : `${reader.name} voltará a poder realizar empréstimos.`
        }
        confirmLabel={confirming.kind === 'block' ? 'Bloquear' : 'Desbloquear'}
        destructive={confirming.kind === 'block'}
        loading={busy}
        onConfirm={toggleBlock}
      />
    </div>
  );
}