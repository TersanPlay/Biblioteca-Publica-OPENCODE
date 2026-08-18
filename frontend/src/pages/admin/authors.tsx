import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
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
import { Skeleton } from '../../components/ui/skeleton';
import { authorsApi } from '../../features/api';
import { useAsyncData } from '../../features/hooks/use-async-data';
import { useDebounce } from '../../features/hooks/use-debounce';
import { useApiToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';
import type { Author } from '../../types/api';

const schema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
});

export function AuthorsPage() {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 350);
  const [page, setPage] = useState(1);
  const fetcher = () => authorsApi.list({ search: debounced || undefined, page, pageSize: 12 });
  const { data, error, loading, refetch } = useAsyncData(fetcher, [debounced, page]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Author | null>(null);
  const [deactivating, setDeactivating] = useState<Author | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useApiToast();

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  const openNew = () => {
    setEditing(null);
    reset({ name: '' });
    setDialogOpen(true);
  };

  const openEdit = (a: Author) => {
    setEditing(a);
    reset({ name: a.name });
    setDialogOpen(true);
  };

  const submit = async (v: { name: string }) => {
    setBusy(true);
    try {
      if (editing) {
        await authorsApi.update(editing.id, { name: v.name });
        toast.success('Autor atualizado');
      } else {
        await authorsApi.create({ name: v.name });
        toast.success('Autor cadastrado');
      }
      setDialogOpen(false);
      refetch();
    } catch (err) {
      toast.error('Não foi possível salvar', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivating) return;
    setBusy(true);
    try {
      if (deactivating.isActive) await authorsApi.deactivate(deactivating.id);
      else await authorsApi.reactivate(deactivating.id);
      toast.success(deactivating.isActive ? 'Autor desativado' : 'Autor reativado');
      setDeactivating(null);
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
        title="Autores"
        description={`${data?.total ?? 0} autores cadastrados`}
        actions={<Button onClick={openNew}><Plus className="size-4" /> Novo autor</Button>}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar autor..."
          className="h-10 w-full rounded-control bg-surface pl-10 pr-3 text-sm text-ink shadow-[inset_0_0_0_1px_rgba(23,26,26,.1)] focus:outline-none focus:shadow-[inset_0_0_0_2px_#087F8C]"
        />
      </div>

      {error ? (
        <Card variant="soft" className="py-12 text-center">
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </Card>
      ) : loading ? (
        <Card className="p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-14" />
          ))}
        </Card>
      ) : data && data.items.length === 0 ? (
        <Card variant="soft">
          <EmptyState title="Nenhum autor encontrado" action={<Button size="sm" onClick={openNew}>Cadastrar autor</Button>} />
        </Card>
      ) : (
        data && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((a) => (
                <Card key={a.id} className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold text-ink">{a.name}</p>
                    </div>
                    <Badge variant={a.isActive ? 'success' : 'neutral'} dot>
                      {a.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-muted">
                      {a._count?.books ?? 0} livro{a._count?.books === 1 ? '' : 's'}
                    </span>
                    <div className="flex gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(a)}>
                        Editar
                      </Button>
                      <Button
                        variant={a.isActive ? 'ghost' : 'secondary'}
                        size="sm"
                        onClick={() => setDeactivating(a)}
                      >
                        {a.isActive ? 'Desativar' : 'Reativar'}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
          </>
        )
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader title={editing ? 'Editar autor' : 'Novo autor'} />
          <form onSubmit={handleSubmit(submit)}>
            <DialogBody>
              <div>
                <Label>Nome *</Label>
                <Input placeholder="Nome do autor" error={errors.name?.message} {...register('name')} />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={busy}>{editing ? 'Salvar' : 'Cadastrar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={deactivating?.isActive ? 'Desativar autor' : 'Reativar autor'}
        description={
          deactivating?.isActive
            ? `"${deactivating?.name}" deixará de aparecer em novas seleções de livros.`
            : `"${deactivating?.name}" voltará a aparecer em novas seleções.`
        }
        confirmLabel={deactivating?.isActive ? 'Desativar' : 'Reativar'}
        loading={busy}
        onConfirm={confirmDeactivate}
      />
    </div>
  );
}
