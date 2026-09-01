import { useMemo, useState } from 'react';
import { BookMarked, Hash, Search } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { cddIndex, type CddClass } from '../../data/cdd-index';

function CddSection({ c }: { c: CddClass }) {
  return (
    <section
      id={`cdd-${c.codigo}`}
      className="scroll-mt-32 overflow-hidden rounded-shell bg-white/[0.45] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.78),0_0_0_1px_var(--hairline),0_24px_48px_-32px_rgba(23,26,26,.24)]"
    >
      <div className="rounded-core bg-surface shadow-[inset_0_0_0_1px_var(--hairline)]">
        <header className="flex flex-wrap items-center gap-4 border-b border-black/5 px-5 py-4 sm:px-6">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-control bg-primary text-white shadow-card">
            <Hash className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[13px] font-bold tracking-tight text-primary">{c.codigo}</p>
            <h2 className="text-lg font-extrabold leading-tight tracking-tight text-ink">{c.descricao}</h2>
          </div>
          <Badge variant="neutral">{c.subclasses.length} itens</Badge>
        </header>
        <ul className="grid gap-px bg-black/5 sm:grid-cols-2">
          {c.subclasses.map((s) => (
            <li
              key={s.codigo}
              className="flex items-start gap-3 bg-surface px-5 py-3 transition-colors duration-150 hover:bg-surfaceWarm"
            >
              <code className="mt-0.5 shrink-0 rounded-control bg-canvas px-2 py-0.5 font-mono text-[11.5px] font-bold text-primary-dark">
                {s.codigo}
              </code>
              <span className="text-[13.5px] leading-snug text-ink">{s.descricao}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function CddPage() {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return cddIndex;
    const result = cddIndex
      .map((c) => ({
        ...c,
        subclasses: c.subclasses.filter(
          (s) => s.codigo.toLowerCase().includes(q) || s.descricao.toLowerCase().includes(q),
        ),
      }))
      .filter(
        (c) =>
          c.subclasses.length > 0 ||
          c.codigo.toLowerCase().includes(q) ||
          c.descricao.toLowerCase().includes(q),
      );
    return result;
  }, [q]);

  const totalItems = useMemo(
    () => filtered.reduce((acc, c) => acc + c.subclasses.length, 0),
    [filtered],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
      <div className="max-w-2xl">
        <Badge variant="primary" className="mb-4">
          <BookMarked className="size-3.5" />
          Referência de catalogação
        </Badge>
        <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-4xl">
          Índice de Classificação
          <span className="block text-primary">Decimal de Dewey</span>
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
          Consulta das classes e subclasses CDD usadas na organização do acervo. Busque por
          código ou descrição para localizar a área de conhecimento de um livro.
        </p>
      </div>

      <div className="mt-6 max-w-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código ou descrição... ex.: 150, psicologia, filosofia"
            className="h-12 rounded-core bg-surface pl-11 pr-4 text-[14px] shadow-[0_10px_30px_-18px_rgba(23,26,26,.24)]"
          />
        </div>
        <p className="mt-2 text-[12.5px] text-muted">
          {q
            ? `${totalItems} registro${totalItems === 1 ? '' : 's'} encontrado${totalItems === 1 ? '' : 's'} em ${filtered.length} classe${filtered.length === 1 ? '' : 's'}`
            : `${cddIndex.length} classes principais · ${cddIndex.reduce((acc, c) => acc + c.subclasses.length, 0)} subclasses`}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {cddIndex.map((c) => (
          <a
            key={c.codigo}
            href={`#cdd-${c.codigo}`}
            className="rounded-full bg-surface px-4 py-2 font-mono text-[13px] font-bold text-primary-dark shadow-[inset_0_0_0_1px_var(--hairline)] transition-colors duration-150 hover:bg-surfaceBlue"
          >
            {c.codigo}
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-6 rounded-shell bg-surface px-6 py-10 text-center shadow-[inset_0_0_0_1px_var(--hairline)]">
          <p className="text-[15px] font-bold text-ink">Nenhum registro encontrado</p>
          <p className="mt-1 text-[13px] text-muted">
            Nenhuma classe CDD corresponde a “{query.trim()}”. Tente outro código ou termo.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {filtered.map((c) => (
          <CddSection key={c.codigo} c={c} />
        ))}
      </div>
    </div>
  );
}