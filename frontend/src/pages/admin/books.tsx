import { Link, useSearchParams } from 'react-router-dom';
import { Archive, Pencil, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BookCover } from '../../components/layout/book-cover';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { Pagination } from '../../components/ui/pagination';
import { Skeleton } from '../../components/ui/skeleton';
import { NativeSelect } from '../../components/ui/select';
import { TD, TH, TBody, THead, TR, Table } from '../../components/ui/table';
import { booksApi, categoriesApi } from '../../features/api';
import { useDebounce } from '../../features/hooks/use-debounce';
import { useToast } from '../../features/toast/toast-provider';
import { apiErrorMessage } from '../../lib/errors';
import type { Book, Category, Paginated } from '../../types/api';

const FORMAT_LABELS: Record<string, string> = {
  CAPA: 'Capa',
  BROCHURA: 'Brochura',
  ESPIRAL: 'Espiral',
};

export function BooksPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const format = params.get('format') ?? '';
  const availability = params.get('availability') ?? '';
  const status = params.get('status') ?? 'all';
  const page = Number(params.get('page') ?? '1');

  const [input, setInput] = useState(q);
  const debounced = useDebounce(input, 350);
  const [data, setData] = useState<Paginated<Book> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Book | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setInput(q);
  }, [q]);

  useEffect(() => {
    categoriesApi.all().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    booksApi
      .list({
        search: debounced || undefined,
        categoryId: category || undefined,
        format: format || undefined,
        availability: availability === 'available' ? 'available' : availability === 'unavailable' ? 'unavailable' : undefined,
        includeArchived: status === 'active' ? 0 : 1,
        page,
        pageSize: 10,
      })
      .then(setData)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [debounced, category, format, availability, status, page]);

  const syncParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Livros"
        description={`${data?.total ?? 0} títulos no acervo${status === 'archived' ? ' (arquivados)' : ''}`}
        actions={
          <Link to="/admin/livros/novo">
            <Button>
              <Plus className="size-4" /> Novo livro
            </Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Buscar por título, autor ou ISBN..."
            className="h-10 w-full rounded-control bg-surface pl-10 pr-3 text-sm text-ink shadow-[inset_0_0_0_1px_rgba(23,26,26,.1)] focus:outline-none focus:shadow-[inset_0_0_0_2px_#087F8C]"
          />
        </div>
        <NativeSelect
          value={category || 'all'}
          onChange={(v) => syncParam('category', v === 'all' ? '' : v)}
          options={[{ value: 'all', label: 'Todas as categorias' }, ...categories.map((c) => ({ value: String(c.$id), label: c.name }))]}
          className="lg:w-52"
        />
        <NativeSelect
          value={format || 'all'}
          onChange={(v) => syncParam('format', v === 'all' ? '' : v)}
          options={[
            { value: 'all', label: 'Todos os formatos' },
            { value: 'CAPA', label: 'Capa' },
            { value: 'BROCHURA', label: 'Brochura' },
            { value: 'ESPIRAL', label: 'Espiral' },
          ]}
          className="lg:w-44"
        />
        <NativeSelect
          value={status}
          onChange={(v) => syncParam('status', v === 'all' ? '' : v)}
          options={[
            { value: 'all', label: 'Ativos e arquivados' },
            { value: 'active', label: 'Somente ativos' },
            { value: 'archived', label: 'Somente arquivados' },
          ]}
          className="lg:w-48"
        />
      </div>

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
      ) : data && data.items.length === 0 ? (
        <Card variant="soft">
          <EmptyState
            title="Nenhum livro encontrado"
            description="Ajuste os filtros ou cadastre um novo título."
            action={
              <Link to="/admin/livros/novo">
                <Button size="sm">Cadastrar livro</Button>
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
                    <TH>Capa</TH>
                    <TH>Título</TH>
                    <TH>Categoria</TH>
                    <TH>Formato</TH>
                    <TH className="text-center">Disponibilidade</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Ações</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((b) => (
                    <TR key={b.$id}>
                      <TD>
                        <BookCover
                          src={b.coverUrl}
                          title={b.title}
                          className="h-14 w-10 rounded-small"
                        />
                      </TD>
                      <TD>
                        <Link to={`/livros/${b.$id}`} state={{ fromAdmin: true }} className="line-clamp-1 max-w-64 font-bold text-ink hover:text-primary">
                          {b.title}
                        </Link>
                        {(b.isbn13 ?? b.isbn10) && (
                          <p className="font-mono text-[11px] text-muted">{b.isbn13 ?? b.isbn10}</p>
                        )}
                      </TD>
                      <TD>
                        {b.categoryNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {b.categoryNames.map((n, i) => (
                              <Badge key={`${n}-${i}`} variant="primary">{n}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TD>
                      <TD>
                        {b.format ? (
                          <Badge variant="neutral">{FORMAT_LABELS[b.format] ?? b.format}</Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TD>
                      <TD className="text-center">
                        {b.isAvailable ? (
                          <Badge variant="success" dot>
                            Disponível
                          </Badge>
                        ) : (
                          <Badge variant="warning" dot>
                            Indisponível
                          </Badge>
                        )}
                      </TD>
                      <TD>
                        {b.isArchived ? (
                          <Badge variant="neutral">Arquivado</Badge>
                        ) : (
                          <Badge variant="success" dot>
                            Ativo
                          </Badge>
                        )}
                      </TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link to={`/admin/livros/${b.$id}/editar`}>
                            <Button variant="secondary" size="icon-sm" aria-label="Editar livro">
                              <Pencil className="size-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="secondary"
                            size="icon-sm"
                            aria-label={b.isArchived ? 'Restaurar livro' : 'Arquivar livro'}
                            onClick={() => setArchiving(b)}
                          >
                            {b.isArchived ? (
                              <Archive className="size-4 text-success" />
                            ) : (
                              <Archive className="size-4 text-muted" />
                            )}
                          </Button>
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

      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={archiving?.isArchived ? 'Restaurar livro' : 'Arquivar livro'}
        description={
          archiving?.isArchived
            ? `O título "${archiving?.title}" voltará a aparecer no catálogo público.`
            : `O título "${archiving?.title}" deixará de aparecer no catálogo público, mas o histórico será mantido.`
        }
        confirmLabel={archiving?.isArchived ? 'Restaurar' : 'Arquivar'}
        onConfirm={async () => {
          if (!archiving) return;
          try {
            if (archiving.isArchived) await booksApi.restore(archiving.$id);
            else await booksApi.archive(archiving.$id);
            toast('success', archiving.isArchived ? 'Livro restaurado' : 'Livro arquivado');
            setArchiving(null);
            setLoading(true);
            booksApi
              .list({ search: debounced || undefined, categoryId: category || undefined, format: format || undefined, availability: availability === 'available' ? 'available' : availability === 'unavailable' ? 'unavailable' : undefined, includeArchived: status === 'active' ? 0 : 1, page, pageSize: 10 })
              .then(setData)
              .catch((err) => setError(apiErrorMessage(err)))
              .finally(() => setLoading(false));
          } catch (err) {
            toast('error', 'Não foi possível concluir', apiErrorMessage(err));
          }
        }}
      />
    </div>
  );
}
