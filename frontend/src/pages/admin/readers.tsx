import { Link, useSearchParams } from 'react-router-dom';
import { Ban, CheckCircle2, Plus, Search, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader,
} from '../../components/ui/dialog';
import { EmptyState } from '../../components/ui/empty-state';
import { Label } from '../../components/ui/form-field';
import { Input } from '../../components/ui/input';
import { PageHeader } from '../../components/ui/page-header';
import { Pagination } from '../../components/ui/pagination';
import { NativeSelect } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { ReaderStatusBadge } from '../../components/ui/status-badge';
import { TD, TH, TBody, THead, TR, Table } from '../../components/ui/table';
import { readersApi } from '../../features/api';
import { useAsyncData } from '../../features/hooks/use-async-data';
import { useDebounce } from '../../features/hooks/use-debounce';
import { useApiToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';
import { formatCPF, formatDate, formatPhone, onlyDigits } from '../../lib/format';
import type { Reader } from '../../types/api';

const schema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  cpf: z
    .string()
    .refine((v) => onlyDigits(v).length === 11, 'CPF deve ter 11 dígitos'),
  birthDate: z.string(),
  phone: z.string(),
  email: z.string().email('E-mail inválido').or(z.literal('')),
  cep: z.string(),
  address: z.string(),
  number: z.string(),
  neighborhood: z.string(),
  city: z.string(),
  state: z.string(),
});

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'BLOCKED', label: 'Bloqueados' },
  { value: 'INACTIVE', label: 'Inativos' },
];

export function ReadersPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? 'all';
  const page = Number(params.get('page') ?? '1');
  const [input, setInput] = useState(q);
  const debounced = useDebounce(input, 350);

  const fetcher = () =>
    readersApi.list({ search: debounced || undefined, status: status !== 'all' ? status : undefined, page, pageSize: 12 });
  const { data, error, loading, refetch } = useAsyncData(fetcher, [debounced, status, page]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [blocking, setBlocking] = useState<Reader | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useApiToast();

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', cpf: '', birthDate: '', phone: '', email: '',
      cep: '', address: '', number: '', neighborhood: '', city: '', state: '',
    },
  });

  const openNew = () => {
    reset({
      name: '', cpf: '', birthDate: '', phone: '', email: '',
      cep: '', address: '', number: '', neighborhood: '', city: '', state: '',
    });
    setDialogOpen(true);
  };

  const submit = async (v: z.infer<typeof schema>) => {
    setBusy(true);
    try {
      const payload = {
        name: v.name,
        cpf: onlyDigits(v.cpf),
        birthDate: v.birthDate || undefined,
        phone: v.phone || undefined,
        email: v.email || undefined,
        cep: v.cep ? onlyDigits(v.cep) : undefined,
        address: v.address || undefined,
        number: v.number || undefined,
        neighborhood: v.neighborhood || undefined,
        city: v.city || undefined,
        state: v.state || undefined,
      };
      await readersApi.create(payload);
      toast.success('Leitor cadastrado');
      setDialogOpen(false);
      refetch();
    } catch (err) {
      toast.error('Não foi possível cadastrar', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leitores"
        description={`${data?.total ?? 0} pessoas cadastradas na comunidade`}
        actions={<Button onClick={openNew}><Plus className="size-4" /> Novo leitor</Button>}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Buscar por nome, CPF ou e-mail..."
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
          className="lg:w-44"
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
            title="Nenhum leitor encontrado"
            action={<Button size="sm" onClick={openNew}>Cadastrar leitor</Button>}
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
                    <TH>CPF</TH>
                    <TH>Contato</TH>
                    <TH>Cadastrado em</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Ações</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((r) => (
                    <TR key={r.id}>
                      <TD>
                        <Link to={`/admin/leitores/${r.id}`} className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-extrabold text-primary-dark">
                            {r.name.split(' ').slice(0, 2).map((p) => p[0]).join('')}
                          </span>
                          <span className="line-clamp-1 max-w-52 font-bold text-ink hover:text-primary">
                            {r.name}
                          </span>
                        </Link>
                      </TD>
                      <TD className="font-mono text-[12.5px] text-muted">{formatCPF(r.cpf)}</TD>
                      <TD className="max-w-48">
                        <span className="block text-ink/80">{r.email ?? '—'}</span>
                        <span className="block text-[12px] text-muted">{r.phone ? formatPhone(r.phone) : ''}</span>
                      </TD>
                      <TD className="text-muted">{formatDate(r.createdAt)}</TD>
                      <TD>
                        <ReaderStatusBadge status={r.status} />
                      </TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === 'BLOCKED' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await readersApi.unblock(r.id);
                                  toast.success('Leitor desbloqueado');
                                  refetch();
                                } catch (err) {
                                  toast.error('Falha ao desbloquear', apiErrorMessage(err));
                                }
                              }}
                            >
                              <CheckCircle2 className="size-4 text-success" /> Desbloquear
                            </Button>
                          ) : r.status === 'ACTIVE' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setBlocking(r)}
                            >
                              <Ban className="size-4" /> Bloquear
                            </Button>
                          ) : null}
                          <Link to={`/admin/leitores/${r.id}`}>
                            <Button variant="ghost" size="sm">
                              <UserRound className="size-4" /> Ver
                            </Button>
                          </Link>
                        </div>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader title="Novo leitor" description="Dados de identificação e contato." />
          <form onSubmit={handleSubmit(submit)}>
            <DialogBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Nome completo *</Label>
                  <Input placeholder="Maria da Silva" error={errors.name?.message} {...register('name')} />
                </div>
                <div>
                  <Label>CPF *</Label>
                  <Input
                    placeholder="123.456.789-00"
                    error={errors.cpf?.message}
                    inputMode="numeric"
                    {...register('cpf')}
                  />
                </div>
                <div>
                  <Label>Data de nascimento</Label>
                  <Input type="date" {...register('birthDate')} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input placeholder="(11) 99999-9999" {...register('phone')} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" placeholder="maria@email.com" error={errors.email?.message} {...register('email')} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input placeholder="01234-000" {...register('cep')} />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input placeholder="SP" {...register('state')} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input placeholder="Rua das Flores, 100" {...register('address')} />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input placeholder="100" {...register('number')} />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input placeholder="Centro" {...register('neighborhood')} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Cidade</Label>
                  <Input placeholder="São Paulo" {...register('city')} />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={busy}>Cadastrar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!blocking}
        onOpenChange={(o) => !o && setBlocking(null)}
        title="Bloquear leitor"
        description={`${blocking?.name} não poderá realizar novos empréstimos até ser desbloqueado.`}
        confirmLabel="Bloquear"
        destructive
        loading={busy}
        onConfirm={async () => {
          if (!blocking) return;
          setBusy(true);
          try {
            await readersApi.block(blocking.id);
            toast.success('Leitor bloqueado');
            setBlocking(null);
            refetch();
          } catch (err) {
            toast.error('Não foi possível bloquear', apiErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}