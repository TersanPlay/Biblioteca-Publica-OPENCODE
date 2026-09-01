import { Link, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarDays, Globe2, Layers, Library, ListOrdered } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BookCover } from '../../components/layout/book-cover';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { booksApi } from '../../features/api';
import type { Book } from '../../types/api';

export function BookDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const bookId = id || '';
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fromAdmin = location.state?.fromAdmin || location.pathname.startsWith('/admin');
  const backLink = fromAdmin ? '/admin/livros' : '/catalogo';
  const backLabel = fromAdmin ? 'Voltar para livros' : 'Voltar ao catálogo';

  useEffect(() => {
    setLoading(true);
    setError(null);
    booksApi
      .get(bookId)
      .then(setBook)
      .catch(() => setError('Livro não encontrado.'))
      .finally(() => setLoading(false));
  }, [bookId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Skeleton className="mb-6 h-6 w-32" />
        <div className="flex flex-col gap-8 md:flex-row">
          <Skeleton className="aspect-[2/3] w-full max-w-xs shrink-0 rounded-shell" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <p className="text-lg font-bold text-ink">{error ?? 'Livro não encontrado.'}</p>
        <Link to={backLink} className="mt-4 inline-block text-[13.5px] font-semibold text-primary hover:underline">
          ← {backLabel}
        </Link>
      </div>
    );
  }

  const info = [
    { icon: CalendarDays, label: 'Ano', value: book.publicationYear ? String(book.publicationYear) : null },
    { icon: Globe2, label: 'Idioma', value: book.language },
    { icon: ListOrdered, label: 'Páginas', value: book.pages ? String(book.pages) : null },
    { icon: Layers, label: 'Edição', value: book.edition ? `${book.edition}ª` : null },
    { icon: Library, label: 'Editora', value: book.publisher },
    { icon: BookOpen, label: 'Categorias', value: book.categoryNames.length > 0 ? book.categoryNames.join(', ') : null },
  ].filter((i) => i.value);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
      <Link
        to={backLink}
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary transition-colors hover:text-primary-dark"
      >
        <ArrowLeft className="size-4" /> {backLabel}
      </Link>

      <div className="grid gap-8 md:grid-cols-[minmax(0,340px)_1fr]">
        <div>
          <BookCover
            src={book.coverUrl}
            title={book.title}
            priority
            className="aspect-[2/3] w-full rounded-shell shadow-soft"
          />
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {book.categoryNames.map((name, i) => (
              <Badge key={`${name}-${i}`} variant="primary">{name}</Badge>
            ))}
            {book.categoryNames.length === 0 && <Badge variant="primary">Sem categoria</Badge>}
            {(book.isbn13 ?? book.isbn10) && <Badge variant="neutral">{book.isbn13 ?? book.isbn10}</Badge>}
            <Badge variant={book.isAvailable ? 'success' : 'warning'} dot>
              {book.hasActiveLoan
                ? 'Aguardando devolução'
                : 'Disponível para empréstimo'}
            </Badge>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {book.title}
          </h1>
          {book.subtitle && <p className="mt-1 text-[16px] font-medium text-muted">{book.subtitle}</p>}
          <p className="mt-2 text-[15px] text-muted">
            {book.authorNames.join(', ')}
          </p>

          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink/80">
            {book.description || 'Descrição não disponível.'}
          </p>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {info.map((i) => (
              <Card key={i.label} variant="plain" className="flex items-center gap-3 p-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surfaceBlue2 text-primary">
                  <i.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-muted">
                    {i.label}
                  </span>
                  <span className="block truncate text-[13px] font-semibold text-ink">{i.value}</span>
                </span>
              </Card>
            ))}
          </div>

          <Card className="mt-7 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[15px] font-bold text-ink">Situação do empréstimo</p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {book.hasActiveLoan
                    ? 'Um leitor está com este livro; aguarde a devolução.'
                    : 'Pronto para retirada no balcão da biblioteca.'}
                </p>
              </div>
              <Badge variant={book.hasActiveLoan ? 'warning' : 'success'} dot>
                {book.hasActiveLoan
                  ? 'Aguardando devolução'
                  : 'Pronto para empréstimo'}
              </Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
