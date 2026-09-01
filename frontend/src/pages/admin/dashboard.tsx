import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarClock,
  TrendingUp,
  Undo2,
  Users,
} from 'lucide-react';
import { useCallback } from 'react';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { PageSkeleton } from '../../components/ui/skeleton';
import { TD, TH, TBody, THead, TR, Table } from '../../components/ui/table';
import { dashboardApi } from '../../features/api';
import { useAsyncData } from '../../features/hooks/use-async-data';
import { useAuth } from '../../features/auth/auth-provider';
import { formatDate } from '../../lib/format';
import { LoanStatusBadge } from '../../components/ui/status-badge';

export function DashboardPage() {
  const { data, error, loading } = useAsyncData(useCallback(() => dashboardApi.get(), []));
  const { user } = useAuth();

  if (loading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <Card variant="soft" className="py-14 text-center">
        <p className="text-sm font-semibold text-destructive">{error ?? 'Erro ao carregar.'}</p>
      </Card>
    );
  }

  const stats = [
    {
      label: 'Livros no acervo',
      value: data.totalBooks,
      icon: BookOpen,
      to: '/admin/livros',
      tone: 'bg-primary-soft text-primary',
    },
    {
      label: 'Disponíveis',
      value: data.availableBooks,
      icon: BookOpen,
      to: '/admin/livros?availability=available',
      tone: 'bg-surfaceBlue text-primary',
    },
    {
      label: 'Emprestados',
      value: data.loanedBooks,
      icon: CalendarClock,
      to: '/admin/emprestimos',
      tone: 'bg-surfaceWarm text-gold',
    },
    {
      label: 'Leitores ativos',
      value: data.activeReaders,
      icon: Users,
      to: '/admin/leitores',
      tone: 'bg-gold-soft text-gold',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Olá, {user?.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-[13.5px] text-muted">
            Visão geral do funcionamento da biblioteca hoje.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" dot>
            {data.availableBooks} livros disponíveis
          </Badge>
          {data.overdueLoans > 0 && (
            <Badge variant="destructive" dot>
              {data.overdueLoans} atrasado{data.overdueLoans > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="group">
            <Card
              pressable
              className="flex items-center justify-between p-5"
            >
              <span>
                <span className="block text-[12px] font-bold uppercase tracking-wide text-muted">
                  {s.label}
                </span>
                <span className="mt-1 block text-3xl font-extrabold tracking-tight text-ink">
                  {s.value}
                </span>
              </span>
              <span className={`flex size-11 items-center justify-center rounded-control ${s.tone}`}>
                <s.icon className="size-5" />
              </span>
            </Card>
          </Link>
        ))}
      </div>

      {data.overdueLoans > 0 && (
        <Card variant="soft" className="border-l-[3px] border-l-destructive">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <span className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-destructive-soft text-destructive">
                <AlertTriangle className="size-4" />
              </span>
              <span>
                <span className="block text-[14px] font-bold text-ink">
                  {data.overdueLoans} empréstimo{data.overdueLoans > 1 ? 's' : ''} em atraso
                </span>
                <span className="block text-[12.5px] text-muted">
                  Cobre as devoluções pendentes no balcão.
                </span>
              </span>
            </span>
            <Link
              to="/admin/devolucoes"
              className="flex items-center gap-1.5 text-[13px] font-bold text-destructive transition-colors hover:text-destructive/80"
            >
              Ver devoluções <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Empréstimos recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentLoans.length === 0 ? (
              <EmptyState compact title="Nenhum empréstimo ainda" description="Registre o primeiro empréstimo pelo balcão." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Leitor</TH>
                    <TH>Livro</TH>
                    <TH>Vencimento</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.recentLoans.map((l) => (
                    <TR key={l.$id}>
                      <TD className="font-semibold text-ink">{l.readerNameSnapshot}</TD>
                      <TD className="max-w-52 truncate text-muted">
                        {l.bookTitleSnapshot}
                      </TD>
                      <TD className="text-muted">{formatDate(l.dueDate)}</TD>
                      <TD>
                        <LoanStatusBadge status={l.status} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Mais emprestados</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topBooks.length === 0 ? (
              <EmptyState compact title="Sem dados ainda" description="Os títulos mais populares aparecerão aqui." />
            ) : (
              <ul className="space-y-2.5">
                {data.topBooks.map((b, i) => (
                  <li key={b.title} className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-small bg-surfaceBlue font-mono text-[12px] font-bold text-primary-dark">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                      {b.title}
                    </span>
                    <span className="flex items-center gap-1 text-[12px] font-bold text-muted">
                      <TrendingUp className="size-3.5 text-success" />
                      {b.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Devoluções recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentReturns.length === 0 ? (
              <EmptyState compact title="Nenhuma devolução recente" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Livro</TH>
                    <TH>Leitor</TH>
                    <TH>Devolvido em</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.recentReturns.map((l) => (
                    <TR key={l.$id}>
                      <TD className="max-w-56 truncate font-semibold text-ink">{l.bookTitleSnapshot}</TD>
                      <TD className="text-muted">{l.readerNameSnapshot}</TD>
                      <TD className="text-muted">{formatDate(l.returnedAt)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card variant="blue">
          <CardHeader>
            <CardTitle>Atalhos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { to: '/admin/emprestimos/novo', label: 'Registrar empréstimo', desc: 'Balcão de atendimento', icon: BookOpen },
              { to: '/admin/devolucoes', label: 'Registrar devolução', desc: 'Receber livros de volta', icon: Undo2 },
              { to: '/admin/leitores', label: 'Cadastrar leitor', desc: 'Novo usuário do acervo', icon: Users },
              { to: '/admin/livros/novo', label: 'Cadastrar livro', desc: 'Ampliar o acervo', icon: BookOpen },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="group flex items-center gap-3 rounded-card bg-surface p-3.5 hairline transition-all duration-200 [transition-timing-function:var(--ease)] hover:-translate-y-0.5 hover:shadow-card active:scale-[.98]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary-dark">
                  <a.icon className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold text-ink">{a.label}</span>
                  <span className="block text-[12px] text-muted">{a.desc}</span>
                </span>
                <ArrowRight className="size-4 text-muted transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
