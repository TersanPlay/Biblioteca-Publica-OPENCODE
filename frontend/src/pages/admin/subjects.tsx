import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
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
import { Skeleton } from '../../components/ui/skeleton';
import { Textarea } from '../../components/ui/textarea';
import { subjectsApi } from '../../features/api';
import { useAsyncData } from '../../features/hooks/use-async-data';
import { useApiToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';
import type { Subject } from '../../types/api';

const schema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  description: z.string(),
});

export function SubjectsPage() {
  const fetcher = useCallback(() => subjectsApi.all(), []);
  const { data, error, loading, refetch } = useAsyncData(fetcher, []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [toggling, setToggling] = useState<Subject | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useApiToast();

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  const openNew = () => {
    setEditing(null);
    reset({ name: '', description: '' });
    setDialogOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    reset({ name: s.name, description: s.description ?? '' });
    setDialogOpen(true);
  };

  const submit = async (v: { name: string; description: string }) => {
    setBusy(true);
    try {
      if (editing) {
        await subjectsApi.update(editing.$id, v);
        toast.success('Assunto atualizado');
      } else {
        await subjectsApi.create(v);
        toast.success('Assunto criado');
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
      if (toggling.status === 'ACTIVE') await subjectsApi.deactivate(toggling.$id);
      else await subjectsApi.reactivate(toggling.$id);
      toast.success(toggling.status === 'ACTIVE' ? 'Assunto desativado' : 'Assunto reativado');
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
        title="Assuntos"
        description={`${data?.length ?? 0} assuntos organizando o acervo`}
        actions={<Button onClick={openNew}><Plus className="size-4" /> Novo assunto</Button>}
      />

      {error ? (
        <Card variant="soft" className="py-12 text-center">
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </Card>
      ) : loading ? (
        <Card className="p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-14" />
          ))}
        </Card>
      ) : data && data.length === 0 ? (
        <Card variant="soft">
          <EmptyState title="Nenhum assunto" action={<Button size="sm" onClick={openNew}>Criar assunto</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((s) => (
            <Card key={s.$id} className="flex items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-ink">{s.name}</p>
                {s.description && (
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{s.description}</p>
                )}
                <p className="mt-1.5 text-[12px] font-semibold text-muted">
                  {s._count?.books ?? 0} livro{s._count?.books === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge variant={s.status === 'ACTIVE' ? 'success' : 'neutral'} dot>
                  {s.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                </Badge>
                <div className="flex gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(s)}>Editar</Button>
                  <Button
                    variant={s.status === 'ACTIVE' ? 'ghost' : 'secondary'}
                    size="sm"
                    onClick={() => setToggling(s)}
                  >
                    {s.status === 'ACTIVE' ? 'Desativar' : 'Reativar'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader title={editing ? 'Editar assunto' : 'Novo assunto'} />
          <form onSubmit={handleSubmit(submit)}>
            <DialogBody>
              <div>
                <Label>Nome *</Label>
                <Input placeholder="Romance" error={errors.name?.message} {...register('name')} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea rows={3} placeholder="Descreva o escopo do assunto..." {...register('description')} />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={busy}>{editing ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.status === 'ACTIVE' ? 'Desativar assunto' : 'Reativar assunto'}
        description={
          toggling?.status === 'ACTIVE'
            ? `"${toggling?.name}" não poderá ser atribuído a novos livros.`
            : `"${toggling?.name}" voltará a ficar disponível para novos livros.`
        }
        confirmLabel={toggling?.status === 'ACTIVE' ? 'Desativar' : 'Reativar'}
        loading={busy}
        onConfirm={confirmToggle}
      />
    </div>
  );
}
