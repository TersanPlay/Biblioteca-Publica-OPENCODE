# Página Pública de Arquitetura Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página pública `/arquitetura` com a arquitetura técnica do projeto + botão personalizado no hero da landing.

**Architecture:** Página estática única sob `PublicLayout`, conteúdo destilado de `docs/arquitetura.md`, sem backend novo. Botão CTA na `HomePage` reutilizando o padrão shell/spotlight da própria landing.

**Tech Stack:** React 18, TypeScript, Tailwind, react-router-dom 6, lucide-react

## Global Constraints

- Conteúdo estático derivado de `docs/arquitetura.md`; sem chamadas de API na página
- Anti-mock: chaves `.env` exibidas apenas como nomes, sem valores
- Sem dependências novas
- Estética: tokens existentes (canvas warm, shells, hairline, primary #087F8C)
- Spec: `docs/superpowers/specs/2026-08-24-architecture-page-design.md`

---

## File Structure

### Created files
- `frontend/src/pages/public/architecture.tsx` — página completa (`ArchitecturePage`) com 6 seções ancoradas

### Modified files
- `frontend/src/app/router/routes.tsx` — importa página, registra rota `arquitetura` no bloco `PublicLayout`
- `frontend/src/pages/public/home.tsx` — adiciona botão personalizado no hero (abaixo da busca)

---

### Task 1: Página `/arquitetura` + rota

**Files:**
- Create: `frontend/src/pages/public/architecture.tsx`
- Modify: `frontend/src/app/router/routes.tsx`

**Interfaces:**
- Produces: `export function ArchitecturePage()` — rota pública `arquitetura` dentro do bloco `PublicLayout`

- [ ] **Step 1: Criar `frontend/src/pages/public/architecture.tsx` com o conteúdo completo**

```tsx
import type { ReactNode } from 'react';
import {
  Boxes,
  FolderTree,
  Layers,
  ListOrdered,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { TD, TH, TBody, THead, TR, Table } from '../../components/ui/table';

const SECTIONS = [
  { id: 'visao-geral', label: 'Visão geral' },
  { id: 'stack', label: 'Stack' },
  { id: 'estrutura', label: 'Estrutura' },
  { id: 'fluxo-de-dados', label: 'Fluxo de dados' },
  { id: 'seguranca', label: 'Segurança' },
  { id: 'operacao', label: 'Operação' },
];

const BACKEND_STACK = [
  ['Runtime', 'Node.js + TypeScript (tsx watch)'],
  ['HTTP', 'Express 4'],
  ['ORM', 'Prisma 5 (@prisma/client)'],
  ['Banco', 'SQLite (backend/prisma/dev.db)'],
  ['Validação', 'Zod 3 (src/validation.ts)'],
  ['Autenticação', 'JWT (jsonwebtoken) + bcryptjs'],
  ['Rate limit', 'express-rate-limit'],
  ['Cron', 'node-cron (backups automáticos)'],
] as const;

const FRONTEND_STACK = [
  ['Framework', 'React 18 + TypeScript'],
  ['Build', 'Vite 5'],
  ['Estilo', 'Tailwind CSS 3 + Radix UI + Lucide'],
  ['Formulários', 'React Hook Form + Zod resolvers'],
  ['Rotas', 'React Router 6'],
  ['HTTP', 'Axios (interceptor JWT)'],
] as const;

const FLOW_STEPS = [
  'A SPA chama os clientes de features/api.ts (ex.: loansApi.createBatch).',
  'O interceptor de services/axios.ts injeta Authorization: Bearer <token> salvo em localStorage.',
  'O Express roteia para o módulo correspondente (app.ts monta /api/<recurso>).',
  'Corpo e query são validados com Zod; falha responde 400 com { error }.',
  'A regra de negócio roda via Prisma (SQLite), geralmente em $transaction.',
  'Toda mutação registra auditoria com writeAudit().',
  'Erros conhecidos viram HttpError; o errorHandler devolve { error } com o status correto.',
  'Em 401 (fora do login), o interceptor limpa o token e encerra a sessão.',
];

const ENV_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_EXPIRES',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'CORS_ORIGIN',
  'VITE_API_URL',
];

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: typeof Layers;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-4 flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-ink">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
          <Icon className="size-[18px]" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-card hairline">{children}</div>
  );
}

function LayerBox({
  title,
  sub,
  primary,
}: {
  title: string;
  sub: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`flex min-h-28 flex-col justify-center rounded-card p-4 text-center shadow-card ${
        primary ? 'bg-primary text-white' : 'bg-surface text-ink hairline'
      }`}
    >
      <span className="text-[14px] font-extrabold leading-tight">{title}</span>
      <span className={`mt-1 text-[12px] ${primary ? 'text-white/80' : 'text-muted'}`}>{sub}</span>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-row items-center justify-center gap-1.5 py-1 md:flex-col md:gap-0.5 md:py-0">
      <span className="hidden text-[10.5px] font-bold uppercase tracking-wide text-muted md:block">
        {label}
      </span>
      <svg
        viewBox="0 0 24 24"
        className="size-5 rotate-90 text-primary md:rotate-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted md:hidden">
        {label}
      </span>
    </div>
  );
}

export function ArchitecturePage() {
  return (
    <div className="bg-canvasWarm">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <header className="reveal in max-w-3xl">
          <Badge variant="primary" className="mb-4">
            <Boxes className="size-3.5" />
            Documentação técnica
          </Badge>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-ink">
            Arquitetura <span className="block text-primary">do projeto</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-muted">
            Como a biblioteca digital é construída: camadas, tecnologias, fluxo de dados,
            segurança e operação.
          </p>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
          <nav aria-label="Seções" className="lg:sticky lg:top-24 lg:self-start">
            <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {SECTIONS.map((s) => (
                <li key={s.id} className="shrink-0 lg:shrink">
                  <a
                    href={`#${s.id}`}
                    className="block whitespace-nowrap rounded-control px-3 py-2 text-[13px] font-bold text-muted transition-colors duration-150 hover:bg-surface hover:text-ink lg:whitespace-normal"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <main className="space-y-12">
            <Section id="visao-geral" icon={Layers} title="Visão geral">
              <Card>
                <div className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
                  <LayerBox title="Frontend" sub="React + Vite · porta 5173" />
                  <FlowArrow label="HTTP/JSON · JWT Bearer" />
                  <LayerBox primary title="Backend" sub="Express API · porta 3333 /api" />
                  <FlowArrow label="Prisma ORM" />
                  <LayerBox title="SQLite" sub="backend/prisma/dev.db" />
                </div>
                <p className="mt-4 text-[13px] leading-relaxed text-muted">
                  SPA autenticada por JWT stateless. Em desenvolvimento, o Vite faz proxy de
                  {' '}<code className="rounded bg-surfaceWarm px-1.5 py-0.5 font-mono text-[11.5px]">/api</code>{' '}
                  para a porta 3333. O schema Prisma está preparado para migração futura ao PostgreSQL.
                </p>
              </Card>
            </Section>

            <Section id="stack" icon={Boxes} title="Stack">
              <div className="grid gap-3 md:grid-cols-2">
                <Card>
                  <h3 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-primary-dark">
                    Backend
                  </h3>
                  <dl className="space-y-2.5">
                    {BACKEND_STACK.map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-3">
                        <dt className="text-[12.5px] font-bold uppercase tracking-wide text-muted">{k}</dt>
                        <dd className="text-right text-[13px] font-semibold text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
                <Card>
                  <h3 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-primary-dark">
                    Frontend
                  </h3>
                  <dl className="space-y-2.5">
                    {FRONTEND_STACK.map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-3">
                        <dt className="text-[12.5px] font-bold uppercase tracking-wide text-muted">{k}</dt>
                        <dd className="text-right text-[13px] font-semibold text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              </div>
            </Section>

            <Section id="estrutura" icon={FolderTree} title="Estrutura">
              <Card>
                <pre className="overflow-x-auto rounded-control bg-surfaceWarm p-4 font-mono text-[12px] leading-relaxed text-ink">
{`backend/
  prisma/schema.prisma      Modelos do banco
  scripts/smoke.ts          Suíte E2E via API
  src/
    app.ts                  Routers, CORS, handlers de erro
    validation.ts           Schemas Zod + helpers
    lib/                    prisma, audit, overdue, cover...
    middleware/             auth, rate-limits, errors
    modules/                Um router por domínio

frontend/
  src/
    app/router/             Rotas e guardas
    components/             layout/ e ui/ (design system)
    features/api.ts         Clientes por entidade
    pages/public|admin/     Páginas
    services/axios.ts       Interceptor JWT + logout 401
    types/api.ts            Tipos das entidades`}
                </pre>
              </Card>
            </Section>

            <Section id="fluxo-de-dados" icon={ListOrdered} title="Fluxo de dados">
              <Card>
                <ol className="space-y-3">
                  {FLOW_STEPS.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-extrabold text-white">
                        {i + 1}
                      </span>
                      <span className="text-[13.5px] leading-relaxed text-ink">{step}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </Section>

            <Section id="seguranca" icon={ShieldCheck} title="Segurança">
              <div className="space-y-3">
                <Card>
                  <ul className="space-y-2 text-[13.5px] leading-relaxed text-ink">
                    <li>• Login valida credenciais com bcrypt e emite JWT assinado com expiração padrão de 8 horas.</li>
                    <li>• Comparação contra hash dummy quando o usuário não existe, evitando enumeração de e-mails.</li>
                    <li>• requireAuth consulta o banco a cada requisição: usuário precisa existir e estar ACTIVE.</li>
                    <li>• Rate limits: login 10 tentativas / 15 min · consulta de capa 30 / 15 min.</li>
                  </ul>
                </Card>
                <Card>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Papel</TH>
                        <TH>Acesso</TH>
                      </TR>
                    </THead>
                    <TBody>
                      <TR>
                        <TD className="font-extrabold">ADMIN</TD>
                        <TD>Tudo: acervo, circulação, relatórios, usuários, configurações, auditoria e backup</TD>
                      </TR>
                      <TR>
                        <TD className="font-extrabold">ATTENDANT</TD>
                        <TD>Operação do dia a dia: acervo, empréstimos, devoluções, reservas e leitores</TD>
                      </TR>
                    </TBody>
                  </Table>
                </Card>
              </div>
            </Section>

            <Section id="operacao" icon={Wrench} title="Operação">
              <div className="space-y-3">
                <Card>
                  <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-primary-dark">
                    Backups
                  </h3>
                  <p className="text-[13.5px] leading-relaxed text-ink">
                    Automáticos às 18:30 e 23:45 via node-cron usando{' '}
                    <code className="rounded bg-surfaceWarm px-1.5 py-0.5 font-mono text-[11.5px]">VACUUM INTO</code>,
                    com rotação dos 5 arquivos mais recentes e restauração protegida por papel ADMIN.
                  </p>
                </Card>
                <Card>
                  <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-primary-dark">
                    Erros
                  </h3>
                  <p className="mb-2 text-[13.5px] leading-relaxed text-ink">
                    Formato único{' '}
                    <code className="rounded bg-surfaceWarm px-1.5 py-0.5 font-mono text-[11.5px]">{`{ "error": "<mensagem>" }`}</code>.
                    Validação 400 · negócio 400/401/403/404/409 · duplicado 409 · inexistente 404 · não tratado 500.
                  </p>
                </Card>
                <Card>
                  <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-primary-dark">
                    Ambiente
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {ENV_KEYS.map((key) => (
                      <code
                        key={key}
                        className="rounded-full bg-surfaceWarm px-2.5 py-1 font-mono text-[11px] font-bold text-ink"
                      >
                        {key}
                      </code>
                    ))}
                  </div>
                  <p className="mt-2 text-[12.5px] text-muted">
                    Nomes das variáveis — valores definidos apenas no .env local, nunca versionados.
                  </p>
                </Card>
              </div>
            </Section>
          </main>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Registrar a rota em `routes.tsx`**

Adicionar ao bloco `<Route element={<PublicLayout />}>`, após a rota `livros/:id`:

```tsx
<Route path="arquitetura" element={<ArchitecturePage />} />
```

E adicionar o import junto aos demais imports públicos:

```tsx
import { ArchitecturePage } from '../../pages/public/architecture';
```

- [ ] **Step 3: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/public/architecture.tsx frontend/src/app/router/routes.tsx
git commit -m "feat(architecture-page): rota publica /arquitetura"
```

---

### Task 2: Botão personalizado na landing

**Files:**
- Modify: `frontend/src/pages/public/home.tsx`

**Interfaces:**
- Consumes: `ArchitecturePage` via rota `/arquitetura` (Task 1); helpers locais `trackSpotlight`, `Spotlight`, `shellCls`, `coreCls` já existentes em `home.tsx`
- Produces: CTA visual exclusivo no hero, abaixo da busca, apontando para `/arquitetura`

- [ ] **Step 1: Adicionar ícone `Blocks` ao import do lucide**

Linha 2 de `home.tsx`:

```tsx
import { ArrowRight, Blocks, BookOpen, CalendarCheck, Clock3, Globe, Library, Search, ShieldCheck, Sparkles } from 'lucide-react';
```

- [ ] **Step 2: Inserir o CTA após o `</form>` da busca no hero**

Localizar o fechamento `</form>` dentro da primeira `<section>` e inserir logo depois (ainda dentro do container `max-w-7xl`):

```tsx
          <Link
            to="/arquitetura"
            onMouseMove={trackSpotlight}
            className={cn(shellCls, 'mt-5 inline-block max-w-sm')}
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
```

- [ ] **Step 3: Verificar tipos e build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: sem erros; build concluído

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/public/home.tsx
git commit -m "feat(architecture-page): botao de arquitetura na landing"
```

---

### Task 3: Verificação final

**Files:** nenhum (somente verificação)

- [ ] **Step 1: Typecheck frontend limpo**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 2: Build de produção**

Run: `cd frontend && npm run build`
Expected: build concluído sem erros (warning de chunk size é pré-existente)

- [ ] **Step 3: Smoke manual (servidores dev)**

1. `cd backend && npm run dev` + `cd frontend && npm run dev`
2. Abrir `http://localhost:5173/` — botão "Arquitetura do projeto" visível abaixo da busca
3. Clicar no botão — navega para `/arquitetura` sem auth
4. Nas 6 âncoras da nav, clicar cada uma e confirmar scroll até a seção
5. Confirmar diagrama com 3 camadas e setas visíveis (desktop e mobile estreito)
