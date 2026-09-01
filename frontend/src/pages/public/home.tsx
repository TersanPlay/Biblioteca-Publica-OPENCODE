import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Blocks, BookOpen, CalendarCheck, Clock3, Globe, Hash, Library, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Badge } from '../../components/ui/badge';
import { useAuth } from '../../features/auth/auth-provider';
import { cn } from '../../lib/utils';

const shellCls =
  'group relative rounded-shell bg-white/[0.45] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.78),0_0_0_1px_var(--hairline),0_24px_48px_-32px_rgba(23,26,26,.24)] transition-all duration-300 [transition-timing-function:var(--ease)] hover:-translate-y-[3px] hover:shadow-[inset_0_1px_0_rgba(255,255,255,.86),0_0_0_1px_rgba(8,127,140,.12),0_28px_52px_-36px_rgba(7,94,103,.3)]';

const coreCls =
  'relative z-[1] h-full overflow-hidden rounded-core bg-surface shadow-[inset_0_0_0_1px_var(--hairline)]';

function trackSpotlight(e: MouseEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
}

function Spotlight() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[2] rounded-shell opacity-0 transition-opacity duration-300 [transition-timing-function:var(--ease)] group-hover:opacity-100"
      style={{
        background:
          'radial-gradient(280px circle at var(--mx,50%) var(--my,50%), rgba(8,127,140,.12), transparent 62%)',
      }}
    />
  );
}

export function HomePage() {
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  return (
    <div ref={rootRef} className="bg-canvasWarm">
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(900px 380px at 18% -10%, rgba(8,127,140,.14), transparent 60%), radial-gradient(700px 320px at 85% 0%, rgba(200,155,91,.16), transparent 60%)',
          }}
        />
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
          <div className="reveal in max-w-2xl">
            <Badge variant="primary" className="mb-4">
              <Sparkles className="size-3.5" />
              Acervo público &amp; gratuito
            </Badge>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl">
              A leitura começa
              <span className="block text-primary">aqui, em comunidade.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-muted">
              Consulte o catálogo, veja disponibilidade em tempo real e descubra o próximo livro da
              sua estante. A equipe da biblioteca gerencia tudo pelo painel de gestão.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) navigate(`/catalogo?q=${encodeURIComponent(query.trim())}`);
            }}
            className="mt-8 max-w-2xl"
          >
            <div className="shell flex items-center gap-2 p-2">
              <Search className="ml-3 size-5 shrink-0 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Título, autor, ISBN... ex.: Dom Casmurro"
                className="h-11 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted/60"
              />
              <Link
                to={`/catalogo?q=${encodeURIComponent(query.trim())}`}
                className="hidden h-11 shrink-0 items-center gap-1.5 rounded-core bg-primary px-5 text-sm font-semibold text-white shadow-card transition-all duration-200 [transition-timing-function:var(--ease)] hover:bg-primary-dark active:scale-[.98] sm:flex"
              >
                Buscar
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </form>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/arquitetura"
              onMouseMove={trackSpotlight}
              className={cn(shellCls, 'inline-block max-w-sm')}
            >
              <Spotlight />
              <span className={cn(coreCls, 'flex items-center gap-4 p-4')}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
                  <Blocks className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-ink">Arquitetura do projeto</span>
                  <span className="block text-[12.5px] text-muted">Veja como o sistema foi construído</span>
                </span>
                <ArrowRight className="ml-auto size-4 shrink-0 text-primary transition-transform duration-200 [transition-timing-function:var(--ease)] group-hover:translate-x-1" />
              </span>
            </Link>
            <Link
              to="/indice-cdd"
              onMouseMove={trackSpotlight}
              className={cn(shellCls, 'inline-block max-w-sm')}
            >
              <Spotlight />
              <span className={cn(coreCls, 'flex items-center gap-4 p-4')}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-gold-soft text-gold">
                  <Hash className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-ink">Índice CDD</span>
                  <span className="block text-[12.5px] text-muted">Classes da Classificação Decimal de Dewey</span>
                </span>
                <ArrowRight className="ml-auto size-4 shrink-0 text-gold transition-transform duration-200 [transition-timing-function:var(--ease)] group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Link
            to="/catalogo"
            onMouseMove={trackSpotlight}
            className={cn(
              shellCls,
              'md:col-span-2 xl:col-span-2 xl:row-span-2 active:scale-[.99]',
            )}
          >
            <Spotlight />
            <span className={cn(coreCls, 'flex min-h-56 flex-col bg-primary p-6 text-white')}>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(420px 260px at 85% -10%, rgba(255,255,255,.18), transparent 60%), radial-gradient(360px 240px at -10% 110%, rgba(0,0,0,.14), transparent 60%)',
                }}
              />
              <span className="relative flex size-12 items-center justify-center rounded-control bg-white/15">
                <Library className="size-6" />
              </span>
              <span className="relative mt-auto pt-8">
                <span className="block text-lg font-extrabold leading-tight">
                  Catálogo por assuntos
                </span>
                <span className="mt-1.5 block text-[13.5px] leading-relaxed text-white/80">
                  Navegue por assunto e descubra o acervo completo da biblioteca, com
                  disponibilidade em tempo real.
                </span>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">
                  Explorar catálogo
                  <ArrowRight className="size-4 transition-transform duration-200 [transition-timing-function:var(--ease)] group-hover:translate-x-1" />
                </span>
              </span>
            </span>
          </Link>

          {[
            { icon: BookOpen, title: 'Empréstimo presencial', desc: 'Retire na estante com a equipe', blue: true },
            { icon: CalendarCheck, title: 'Reservas', desc: 'Agende seu livro pelo catálogo', blue: false },
            { icon: Clock3, title: 'Devolução flexível', desc: 'Renove direto no balcão', blue: false },
            { icon: Globe, title: 'Catálogo online', desc: 'Consulte de qualquer lugar', blue: false },
          ].map((f) => (
            <div
              key={f.title}
              onMouseMove={trackSpotlight}
              className={cn(shellCls, 'xl:col-span-2')}
            >
              <Spotlight />
              <div
                className={cn(
                  coreCls,
                  'flex items-center gap-4 p-5',
                  f.blue && 'bg-[linear-gradient(180deg,#EEF7F7,#E5F2F2)]',
                )}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-surface text-primary shadow-card">
                  <f.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-[14px] font-bold text-ink">{f.title}</span>
                  <span className="block text-[12.5px] text-muted">{f.desc}</span>
                </span>
              </div>
            </div>
          ))}

          <div
            onMouseMove={trackSpotlight}
            className={cn(shellCls, 'md:col-span-2 xl:col-span-6')}
          >
            <Spotlight />
            <div className={cn(coreCls, 'flex items-center gap-4 bg-surfaceWarm p-5')}>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(520px 200px at 90% 50%, rgba(8,127,140,.10), transparent 65%)',
                }}
              />
              <span className="relative flex size-11 shrink-0 items-center justify-center rounded-control bg-gold-soft text-gold shadow-card">
                <Sparkles className="size-5" />
              </span>
              <span className="relative">
                <span
                  aria-hidden="true"
                  className="mb-2 block h-[3px] w-[34px] rounded-full bg-gold"
                />
                <span className="block text-[14px] font-bold text-ink">Acervo curado</span>
                <span className="block text-[12.5px] text-muted">
                  Seleção da equipe da biblioteca: as melhores leituras recomendadas para você
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AuthPill() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Link
      to="/admin"
      className="flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-[13px] font-bold text-primary-dark transition-all duration-200 hover:bg-surfaceBlue active:scale-[.98]"
    >
      <ShieldCheck className="size-4" />
      Ir para o painel
    </Link>
  );
}
