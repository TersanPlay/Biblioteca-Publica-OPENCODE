import { useCallback, useState } from 'react';
import { Database, Download, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { PageSkeleton } from '../../components/ui/skeleton';
import { backupsApi } from '../../features/api';
import { useAsyncData } from '../../features/hooks/use-async-data';
import { useApiToast } from '../../features/toast/toast-provider';
import { formatBytes } from '../../lib/format';
import { apiErrorMessage } from '../../lib/errors';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';

export function BackupsPage() {
  const fetcher = useCallback(() => backupsApi.list(), []);
  const { data: backups, loading, error: loadError, refetch } = useAsyncData(fetcher, []);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { toast } = useApiToast();

  const handleCreate = async () => {
    setBusy(true);
    try {
      await backupsApi.create();
      toast.success('Backup criado', 'Backup manual criado com sucesso.');
      refetch();
    } catch (err) {
      toast.error('Erro ao criar backup', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      await backupsApi.download(filename);
    } catch (err) {
      toast.error('Erro ao baixar', apiErrorMessage(err));
    }
  };

  const handleDelete = async (filename: string) => {
    setBusy(true);
    try {
      await backupsApi.remove(filename);
      toast.success('Backup removido', `${filename} excluído.`);
      setConfirmDelete(null);
      refetch();
    } catch (err) {
      toast.error('Erro ao remover', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageSkeleton />;

  if (loadError) {
    return (
      <Card variant="soft" className="py-14 text-center">
        <p className="text-sm font-semibold text-destructive">{loadError}</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Backup & Restauração</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            Backups automáticos diários (18:30 e 23:45). Máximo de 5 arquivos mantidos.
          </p>
        </div>
        <Button onClick={handleCreate} loading={busy}>
          <Database className="size-4" /> Criar backup
        </Button>
      </div>

      <Card className="mt-5">
        {!backups || backups.length === 0 ? (
          <div className="py-14 text-center">
            <Database className="mx-auto mb-3 size-10 text-muted/40" />
            <p className="text-sm font-semibold text-muted">Nenhum backup encontrado</p>
            <p className="mt-1 text-[12.5px] text-muted/70">
              Crie um backup manual ou aguarde o próximo backup automático.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-black/8 text-[11.5px] font-bold uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Arquivo</th>
                  <th className="px-4 py-3">Tamanho</th>
                  <th className="px-4 py-3">Criado em</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.filename} className="border-b border-black/5 last:border-0">
                    <td className="px-4 py-3 font-mono text-[12.5px] font-semibold text-ink">
                      {b.filename}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatBytes(b.size)}</td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(b.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDownload(b.filename)}
                          className="rounded-control p-2 text-muted transition-colors hover:bg-primary-soft hover:text-primary-dark"
                          title="Baixar"
                        >
                          <Download className="size-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(b.filename)}
                          className="rounded-control p-2 text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Excluir"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={() => setConfirmDelete(null)}
        title="Excluir backup?"
        description={`Tem certeza que deseja excluir ${confirmDelete}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => { if (confirmDelete) return handleDelete(confirmDelete); }}
        loading={busy}
      />
    </div>
  );
}
