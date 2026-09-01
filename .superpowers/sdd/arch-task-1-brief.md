# Brief extraído do plano (Task 1)

### Task 1: PÃ¡gina `/arquitetura` + rota

**Files:**
- Create: `frontend/src/pages/public/architecture.tsx`
- Modify: `frontend/src/app/router/routes.tsx`

**Interfaces:**
- Produces: `export function ArchitecturePage()` â€” rota pÃºblica `arquitetura` dentro do bloco `PublicLayout`

- [ ] **Step 1: Criar `frontend/src/pages/public/architecture.tsx` com o conteÃºdo completo**

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
  { id: 'visao-geral', label: 'VisÃ£o geral' },
  { id: 'stack', label: 'Stack' },
  { id: 'estrutura', label: 'Estrutura' },
  { id: 'fluxo-de-dados', label: 'Fluxo de dados' },
  { id: 'seguranca', label: 'SeguranÃ§a' },
  { id: 'operacao', label: 'OperaÃ§Ã£o' },
];

const BACKEND_STACK = [
  ['Runtime', 'Node.js + TypeScript (tsx watch)'],
  ['HTTP', 'Express 4'],
  ['ORM', 'Prisma 5 (@prisma/client)'],
  ['Banco', 'SQLite (backend/prisma/dev.db)'],
  ['ValidaÃ§Ã£o', 'Zod 3 (src/validation.ts)'],
  ['AutenticaÃ§Ã£o', 'JWT (jsonwebtoken) + bcryptjs'],
  ['Rate limit', 'express-rate-limit'],
  ['Cron', 'node-cron (backups automÃ¡ticos)'],
] as const;

const FRONTEND_STACK = [
  ['Framework', 'React 18 + TypeScript'],
  ['Build', 'Vite 5'],
  ['Estilo', 'Tailwind CSS 3 + Radix UI + Lucide'],
  ['FormulÃ¡rios', 'React Hook Form + Zod resolvers'],
  ['Rotas', 'React Router 6'],
  ['HTTP', 'Axios (interceptor JWT)'],
] as const;

const FLOW_STEPS = [
  'A SPA chama os clientes de features/api.ts (ex.: loansApi.createBatch).',
  'O interceptor de services/axios.ts injeta Authorization: Bearer <token> salvo em localStorage.',
  'O Express roteia para o mÃ³dulo correspondente (app.ts monta /api/<recurso>).',
  'Corpo e query sÃ£o validados com Zod; falha responde 400 com { error }.',
  'A regra de negÃ³cio roda via Prisma (SQLite), geralmente em $transaction.',
  'Toda mutaÃ§Ã£o registra auditoria com writeAudit().',
  'Erros conhecidos viram HttpError; o errorHandler devolve { error } com o status correto.',
  'Em 401 (fora do login), o interceptor limpa o token e encerra a sessÃ£o.',
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
            DocumentaÃ§Ã£o tÃ©cnica
          </Badge>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-ink">
            Arquitetura <span className="block text-primary">do projeto</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-muted">
            Como a biblioteca digital Ã© construÃ­da: camadas, tecnologias, fluxo de dados,
            seguranÃ§a e operaÃ§Ã£o.
          </p>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
          <nav aria-label="SeÃ§Ãµes" className="lg:sticky lg:top-24 lg:self-start">
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
            <Section id="visao-geral" icon={Layers} title="VisÃ£o geral">
              <Card>
                <div className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
                  <LayerBox title="Frontend" sub="React + Vite Â· porta 5173" />
                  <FlowArrow label="HTTP/JSON Â· JWT Bearer" />
                  <LayerBox primary title="Backend" sub="Express API Â· porta 3333 /api" />
                  <FlowArrow label="Prisma ORM" />
                  <LayerBox title="SQLite" sub="backend/prisma/dev.db" />
                </div>
                <p className="mt-4 text-[13px] leading-relaxed text-muted">
                  SPA autenticada por JWT stateless. Em desenvolvimento, o Vite faz proxy de
                  {' '}<code className="rounded bg-surfaceWarm px-1.5 py-0.5 font-mono text-[11.5px]">/api</code>{' '}
                  para a porta 3333. O schema Prisma estÃ¡ preparado para migraÃ§Ã£o futura ao PostgreSQL.
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
  scripts/smoke.ts          SuÃ­te E2E via API
  src/
    app.ts                  Routers, CORS, handlers de erro
    validation.ts           Schemas Zod + helpers
    lib/                    prisma, audit, overdue, cover...
    middleware/             auth, rate-limits, errors
    modules/                Um router por domÃ­nio

frontend/
  src/
    app/router/             Rotas e guardas
    components/             layout/ e ui/ (design system)
    features/api.ts         Clientes por entidade
    pages/public|admin/     PÃ¡ginas
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

            <Section id="seguranca" icon={ShieldCheck} title="SeguranÃ§a">
              <div className="space-y-3">
                <Card>
                  <ul className="space-y-2 text-[13.5px] leading-relaxed text-ink">
                    <li>â€¢ Login valida credenciais com bcrypt e emite JWT assinado com expiraÃ§Ã£o padrÃ£o de 8 horas.</li>
                    <li>â€¢ ComparaÃ§Ã£o contra hash dummy quando o usuÃ¡rio nÃ£o existe, evitando enumeraÃ§Ã£o de e-mails.</li>
                    <li>â€¢ requireAuth consulta o banco a cada requisiÃ§Ã£o: usuÃ¡rio precisa existir e estar ACTIVE.</li>
                    <li>â€¢ Rate limits: login 10 tentativas / 15 min Â· consulta de capa 30 / 15 min.</li>
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
                        <TD>Tudo: acervo, circulaÃ§Ã£o, relatÃ³rios, usuÃ¡rios, configuraÃ§Ãµes, auditoria e backup</TD>
                      </TR>
                      <TR>
                        <TD className="font-extrabold">ATTENDANT</TD>
                        <TD>OperaÃ§Ã£o do dia a dia: acervo, emprÃ©stimos, devoluÃ§Ãµes, reservas e leitores</TD>
                      </TR>
                    </TBody>
                  </Table>
                </Card>
              </div>
            </Section>

            <Section id="operacao" icon={Wrench} title="OperaÃ§Ã£o">
              <div className="space-y-3">
                <Card>
                  <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-primary-dark">
                    Backups
                  </h3>
                  <p className="text-[13.5px] leading-relaxed text-ink">
                    AutomÃ¡ticos Ã s 18:30 e 23:45 via node-cron usando{' '}
                    <code className="rounded bg-surfaceWarm px-1.5 py-0.5 font-mono text-[11.5px]">VACUUM INTO</code>,
                    com rotaÃ§Ã£o dos 5 arquivos mais recentes e restauraÃ§Ã£o protegida por papel ADMIN.
                  </p>
                </Card>
                <Card>
                  <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-primary-dark">
                    Erros
                  </h3>
                  <p className="mb-2 text-[13.5px] leading-relaxed text-ink">
                    Formato Ãºnico{' '}
                    <code className="rounded bg-surfaceWarm px-1.5 py-0.5 font-mono text-[11.5px]">{`{ "error": "<mensagem>" }`}</code>.
                    ValidaÃ§Ã£o 400 Â· negÃ³cio 400/401/403/404/409 Â· duplicado 409 Â· inexistente 404 Â· nÃ£o tratado 500.
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
                    Nomes das variÃ¡veis â€” valores definidos apenas no .env local, nunca versionados.
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

Adicionar ao bloco `<Route element={<PublicLayout />}>`, apÃ³s a rota `livros/:id`:

```tsx
<Route path="arquitetura" element={<ArchitecturePage />} />
```

E adicionar o import junto aos demais imports pÃºblicos:

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

