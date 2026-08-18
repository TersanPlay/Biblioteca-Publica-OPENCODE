import { Link } from 'react-router-dom';
import { BookCover } from '../layout/book-cover';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import type { Book } from '../../types/api';

export function CatalogBookCard({ book }: { book: Book }) {
  return (
    <Link
      to={`/livros/${book.id}`}
      className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvasWarm"
    >
      <Card className="overflow-hidden p-0 transition-all duration-300 [transition-timing-function:var(--ease)] group-hover:-translate-y-1.5 group-hover:shadow-pop">
        <div className="overflow-hidden">
          <BookCover
            src={book.coverUrl}
            title={book.title}
            className="aspect-[2/3] w-full transition-transform duration-500 [transition-timing-function:var(--ease)] group-hover:scale-[1.04]"
          />
        </div>
        <div className="p-3.5">
          <p className="line-clamp-2 min-h-[2.6em] text-[13.5px] font-bold leading-snug text-ink group-hover:text-primary">
            {book.title}
          </p>
          <p className="mt-1 line-clamp-1 text-[12px] text-muted">
            {book.authors.map((a) => a.author.name).join(', ')}
          </p>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            {book.isAvailable ? (
              <Badge variant="success" dot>
                Disponível
              </Badge>
            ) : (
              <Badge variant="warning" dot>
                Indisponível
              </Badge>
            )}
            {book.publicationYear ? (
              <span className="text-[11.5px] font-medium tabular-nums text-muted/80">
                {book.publicationYear}
              </span>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}
