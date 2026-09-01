import { useState } from 'react';
import { Plus, Search, UserCog } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '../../components/ui/badge';
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
import { UserStatusBadge } from '../../components/ui/status-badge';
import { TD, TH, TBody, THead, TR, Table } from '../../components/ui/table';
import { usersApi } from '../../features/api';
import { useAsyncData } from '../../features/hooks/use-async-data';
import { useDebounce } from '../../features/hooks/use-debounce';
import { useAuth } from '../../features/auth/auth-provider';
import { useApiToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import type { User } from '../../types/api';

const schema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
  role: z.enum(['ADMIN', 'ATTENDANT']),
});

export function UsersPage() {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 350);
  const [page, setPage] = useState(1);
  const fetcher = () => usersApi.list({ search: debounced || undefined, page, pageSize: 12 });
  const { data, error, loading, refetch } = useAsyncData(fetcher, [debounced, page]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toggling, setToggling] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useApiToast();
  const { user: me } = useAuth();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', role: 'ATTENDANT' },
  });

  const openNew = () => {
    setEditing(null);
    reset({ name: '', email: '', password: '', role: 'ATTENDANT' });
    setDialogOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    reset({ name: u.name, email: u.email, password: '', role: u.role });
    setDialogOpen(true);
  };

  const submit = async (v: z.infer<typeof schema>) => {
    setBusy(true);
    try {
      if (editing) {
        await usersApi.update(editing.$id, {
          name: v.name,
          email: v.email,
          role: v.role,
          password: v.password || undefined,
        });
        toast.success('Usuário atualizado');
      } else {
        await usersApi.create(v);
        toast.success('Usuário criado');
      }
      setDialogOpen(false);
      refetch();
    } catch (err) {
      toast.error('Não foi possível salvar', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    setBusy(true);
    try {
      if (toggling.status === 'ACTIVE') await usersApi.deactivate(toggling.$id);
      else await usersApi.reactivate(toggling.$id);
      toast.success(toggling.status === 'ACTIVE' ? 'Usuário desativado' : 'Usuário reativado');
      setToggling(null);
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
        title="Usuários do sistema"
        description={`${data?.total ?? 0} contas da equipe`}
        actions={<Button onClick={openNew}><Plus className="size-4" /> Novo usuário</Button>}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="h-10 w-full rounded-control bg-surface pl-10 pr-3 text-sm text-ink shadow-[inset_0_0_0_1px_rgba(23,26,26,.1)] focus:outline-none focus:shadow-[inset_0_0_0_2px_#087F8C]"
        />
      </div>

      {error ? (
        <Card variant="soft" className="py-12 text-center">
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </Card>
      ) : loading ? (
        <Card className="p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-12" />
          ))}
        </Card>
      ) : data && data.items.length === 0 ? (
        <Card variant="soft">
          <EmptyState title="Nenhum usuário encontrado" action={<Button size="sm" onClick={openNew}>Criar usuário</Button>} />
        </Card>
      ) : (
        data && (
          <>
            <Card className="overflow-hidden p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Usuário</TH>
                    <TH>Papel</TH>
                    <TH>Criado em</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Ações</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((u) => (
                    <TR key={u.$id}>
                      <TD>
                        <p className="font-bold text-ink">
                          {u.name}
                          {u.$id === me?.id && <span className="ml-2 text-[11px] font-semibold text-primary">(você)</span>}
                        </p>
                        <p className="font-mono text-[12px] text-muted">{u.email}</p>
                      </TD>
                      <TD>
                        <Badge variant={u.role === 'ADMIN' ? 'primary' : 'neutral'}>
                          {u.role === 'ADMIN' ? 'Administrador' : 'Atendente'}
                        </Badge>
                      </TD>
                      <TD className="text-muted">{formatDate(u.$createdAt)}</TD>
                      <TD><UserStatusBadge status={u.status} /></TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => openEdit(u)}>
                            Editar
                          </Button>
                          {u.$id !== me?.id && (
                            <Button
                              variant={u.status === 'ACTIVE' ? 'ghost' : 'secondary'}
                              size="sm"
                              onClick={() => setToggling(u)}
                            >
                              {u.status === 'ACTIVE' ? 'Desativar' : 'Reativar'}
                            </Button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
            <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
          </>
        )
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader title={editing ? 'Editar usuário' : 'Novo usuário'} />
          <form onSubmit={handleSubmit(submit)}>
            <DialogBody>
              <div>
                <Label>Nome *</Label>
                <Input placeholder="Nome da pessoa" error={errors.name?.message} {...register('name')} />
              </div>
              <div>
                <Label>E-mail *</Label>
                <Input type="email" placeholder="pessoa@biblioteca.local" error={errors.email?.message} {...register('email')} />
              </div>
              <div>
                <Label>{editing ? 'Nova senha (opcional)' : 'Senha *'}</Label>
                <Input
                  type="password"
                  placeholder={editing ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres'}
                  error={errors.password?.message}
                  {...register('password')}
                />
              </div>
              <div>
                <Label>Papel</Label>
                <NativeSelect
                  value={watch('role')}
                  onChange={(v) => setValue('role', v as 'ADMIN' | 'ATTENDANT')}
                  options={[
                    { value: 'ADMIN', label: 'Administrador — acesso total' },
                    { value: 'ATTENDANT', label: 'Atendente — operação diária' },
                  ]}
                />
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
                  <UserCog className="size-3.5" /> Atendentes não acessam autoria, assuntos, relatórios, usuários nem configurações.
                </p>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={busy}>{editing ? 'Salvar' : 'Criar usuário'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.status === 'ACTIVE' ? 'Desativar usuário' : 'Reativar usuário'}
        description={
          toggling?.status === 'ACTIVE'
            ? `${toggling?.name} perderá o acesso ao sistema imediatamente.`
            : `${toggling?.name} voltará a acessar o sistema.`
        }
        confirmLabel={toggling?.status === 'ACTIVE' ? 'Desativar' : 'Reativar'}
        destructive={toggling?.status === 'ACTIVE'}
        loading={busy}
        onConfirm={confirmToggle}
      />
    </div>
  );
}