import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../ui/skeleton';

const gradients = [
  'from-[#087F8C] to-[#C89B5B]',
  'from-[#075E67] to-[#087F8C]',
  'from-[#C89B5B] to-[#8A6A3A]',
  'from-[#24404A] to-[#087F8C]',
  'from-[#8A6A3A] to-[#C89B5B]',
];

export function BookCover({
  src,
  title,
  className,
  priority,
}: {
  src?: string | null;
  title: string;
  className?: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(true);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const resetState = () => {
    setFailed(false);
    setLoaded(true);
  };

  useEffect(() => {
    resetState();
  }, [src]);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    if (el.complete) {
      if (el.naturalWidth > 0) setLoaded(false);
      else setFailed(true);
    }
  }, [src]);

  if (src && !failed) {
    return (
      <div className={cn('relative overflow-hidden bg-surfaceBlue', className)}>
        {loaded && <Skeleton className="absolute inset-0" />}
        <img
          ref={imgRef}
          src={src}
          alt={`Capa de ${title}`}
          decoding="async"
          className={cn(
            'h-full w-full object-cover transition-opacity duration-300 [transition-timing-function:var(--ease)]',
            loaded ? 'opacity-0' : 'opacity-100',
          )}
          loading={priority ? 'eager' : 'lazy'}
          onLoad={() => setLoaded(false)}
          onError={() => {
            setLoaded(false);
            setFailed(true);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-gradient-to-br p-3',
        gradients[hashTitle(title) % gradients.length],
        className,
      )}
      aria-label={`Capa de ${title}`}
    >
      <span className="line-clamp-3 text-center text-[13px] font-bold leading-snug text-white/95 [text-shadow:0_1px_8px_rgba(0,0,0,.25)]">
        {title}
      </span>
      <span className="absolute bottom-1.5 right-2 font-mono text-[8.5px] font-medium uppercase tracking-wider text-white/50">
        Livraria
      </span>
    </div>
  );
}

function hashTitle(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) | 0;
  return Math.abs(h);
}
