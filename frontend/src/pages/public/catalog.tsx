import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CatalogBookCard } from '../../components/layout/catalog-book-card';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Pagination } from '../../components/ui/pagination';
import { NativeSelect } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { booksApi, subjectsApi } from '../../features/api';
import { useDebounce } from '../../features/hooks/use-debounce';
import { cn } from '../../lib/utils';
import type { Book, Subject, Paginated } from '../../types/api';

const SORTS = [
  { value: 'newest', label: 'Mais recentes' },
  { value: 'title', label: 'Título (A–Z)' },
  { value: 'oldest', label: 'Mais antigos' },
];

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const subjectId = params.get('subjectId') ?? '';
  const rawSort = params.get('sort');
  const sort = rawSort && rawSort !== 'featured' ? rawSort : 'newest';
  const page = Number(params.get('page') ?? '1');

  const [input, setInput] = useState(q);
  const debounced = useDebounce(input, 350);
  const [data, setData] = useState<Paginated<Book> | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setInput(q);
  }, [q]);

  useEffect(() => {
    subjectsApi.all().then(setSubjects).catch(() => undefined);
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    if (debounced) next.set('q', debounced);
    if (subjectId) next.set('subjectId', subjectId);
    if (sort !== 'newest') next.set('sort', sort);
    if (page > 1) next.set('page', String(page));
    setParams(next, { replace: true });
  }, [debounced, subjectId, sort, page]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    booksApi
      .list({
        search: debounced || undefined,
        subjectId: subjectId || undefined,
        sort: sort !== 'newest' ? sort : undefined,
        page,
        pageSize: 12,
      })
      .then(setData)
      .catch(() => setError('Não foi possível carregar o catálogo.'))
      .finally(() => setLoading(false));
  }, [debounced, subjectId, sort, page, attempt]);

  const setSubjectId = (v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set('subjectId', v);
    else next.delete('subjectId');
    next.delete('page');
    setParams(next);
  };

  const setSort = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === 'newest') next.delete('sort');
    else next.set('sort', v);
    next.delete('page');
    setParams(next);
  };

  const clearFilters = () => {
    setInput('');
    setParams(new URLSearchParams());
  };

  const activeSubject = subjects.find((s) => String(s.$id) === subjectId);
  const hasFilters = Boolean(debounced || subjectId || sort !== 'newest');

  return (
    <div className="bg-canvasWarm">
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(900px 380px at 18% -10%, rgba(8,127,140,.14), transparent 60%), radial-gradient(700px 320px at 85% 0%, rgba(200,155,91,.16), transparent 60%)',
          }}
        />
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pt-12">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-primary">
            Acervo da biblioteca
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-[2.75rem]">
            Catálogo
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
                    Explore todos os livros, filtre por assunto e veja a disponibilidade em tempo real.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="rounded-shell bg-white/[0.48] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.78),0_0_0_1px_var(--hairline),0_18px_40px_-28px_rgba(23,26,26,.24)]">
          <div className="relative flex h-12 items-center rounded-core bg-surface shadow-[inset_0_0_0_1px_var(--hairline)]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Buscar por título, autor, ISBN..."
              className="h-full w-full bg-transparent pl-10 pr-10 text-sm text-ink outline-none placeholder:text-muted/60"
            />
            {input && (
              <button
                onClick={() => setInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted transition-colors hover:bg-canvas hover:text-ink"
                aria-label="Limpar busca"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-shell bg-white/[0.48] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.78),0_0_0_1px_var(--hairline),0_24px_48px_-32px_rgba(23,26,26,.24)]">
              <div className="rounded-core bg-surface p-4 shadow-[inset_0_0_0_1px_var(--hairline)] lg:p-5">
                <p className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
                  <SlidersHorizontal className="size-3.5" />
                  Filtros
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
                  <button
                    onClick={() => setSubjectId('')}
                    className={cn(
                      'shrink-0 rounded-core px-3.5 py-2 text-left text-[13px] font-semibold transition-all duration-200 [transition-timing-function:var(--ease)] lg:flex lg:items-center lg:justify-between lg:gap-2',
                      !subjectId
                        ? 'bg-primary text-white shadow-card'
                        : 'text-muted hover:bg-canvas hover:text-ink',
                    )}
                  >
                    Todos os assuntos
                    <span
                      className={cn(
                        'hidden text-[11.5px] font-bold tabular-nums lg:inline',
                        !subjectId ? 'text-white/80' : 'text-muted/70',
                      )}
                    >
                      {subjects.reduce((sum, s) => sum + (s._count?.books ?? 0), 0)}
                    </span>
                  </button>
                  {subjects.map((s) => (
                    <button
                      key={s.$id}
                      onClick={() => setSubjectId(String(s.$id))}
                      className={cn(
                        'shrink-0 rounded-core px-3.5 py-2 text-left text-[13px] font-semibold transition-all duration-200 [transition-timing-function:var(--ease)] lg:flex lg:items-center lg:justify-between lg:gap-2',
                        subjectId === String(s.$id)
                          ? 'bg-primary text-white shadow-card'
                          : 'text-muted hover:bg-canvas hover:text-ink',
                      )}
                    >
                      {s.name}
                      <span
                        className={cn(
                          'hidden text-[11.5px] font-bold tabular-nums lg:inline',
                          subjectId === String(s.$id) ? 'text-white/80' : 'text-muted/70',
                        )}
                      >
                        {s._count?.books ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <div>
            {hasFilters && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {debounced && (
                  <FilterChip
                    label={`Busca: "${debounced}"`}
                    onClear={() => setInput('')}
                  />
                )}
                {activeSubject && (
                  <FilterChip label={activeSubject.name} onClear={() => setSubjectId('')} />
                )}
                {sort !== 'newest' && (
                  <FilterChip
                    label={SORTS.find((s) => s.value === sort)?.label ?? sort}
                    onClear={() => setSort('newest')}
                  />
                )}
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar tudo
                </Button>
              </div>
            )}

            {error ? (
              <Card variant="soft" className="py-14 text-center">
                <p className="text-sm font-semibold text-destructive">{error}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => setAttempt((a) => a + 1)}
                >
                  Tentar novamente
                </Button>
              </Card>
            ) : loading ? (
              <div>
                <Skeleton className="mb-4 h-4 w-36" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="aspect-[2/3] w-full rounded-card" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              </div>
            ) : data && data.items.length === 0 ? (
              <Card variant="soft">
                <EmptyState
                  title="Nenhum livro encontrado"
                  description="Tente ajustar a busca ou remover filtros."
                  action={
                    <Button variant="secondary" size="sm" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  }
                />
              </Card>
            ) : (
              data && (
                <>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-[13px] font-semibold text-muted">
                      {data.total} {data.total === 1 ? 'livro' : 'livros'}
                    </p>
                    <NativeSelect
                      value={sort}
                      onChange={setSort}
                      options={SORTS}
                      className="w-44"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {data.items.map((b) => (
                      <CatalogBookCard key={b.$id} book={b} />
                    ))}
                  </div>
                  <Pagination
                    className="mt-8"
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
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-[12.5px] font-semibold text-primary-dark">
      {label}
      <button
        onClick={onClear}
        className="rounded-full p-0.5 transition-colors hover:bg-primary/10 hover:text-primary"
        aria-label={`Remover filtro ${label}`}
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}
