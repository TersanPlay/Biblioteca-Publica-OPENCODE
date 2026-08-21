# Arquitetura

## Visão geral

Aplicação web de duas camadas para gestão de biblioteca pública:

```
┌──────────────┐   HTTP/JSON (axios)   ┌──────────────┐   Prisma ORM   ┌────────────┐
│  Frontend    │ ─────────────────────► │  Backend     │ ─────────────► │  SQLite    │
│  React + Vite│ ◄───────────────────── │  Express API │ ◄───────────── │  dev.db    │
└──────────────┘        JWT Bearer      └──────────────┘                └────────────┘
   http://localhost:5173                   http://localhost:3333/api
```

- O frontend é uma SPA (Vite dev na porta 5173) com proxy `/api` → porta 3333 em desenvolvimento.
- O backend expõe uma API REST sob a URL base `/api` (porta 3333).
- O banco é SQLite via Prisma (`backend/prisma/dev.db`), preparado para migração a PostgreSQL.
- Autenticação stateless: JWT assinado, enviado como `Authorization: Bearer <token>`.

## Stack

### Backend (`backend/`)

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js + TypeScript (executado com `tsx watch`) |
| HTTP | Express 4 |
| ORM | Prisma 5 (`@prisma/client`) |
| Banco | SQLite (arquivo `dev.db`), schema em `prisma/schema.prisma` |
| Validação | Zod 3 (`src/validation.ts`) |
| Autenticação | JWT (`jsonwebtoken`) + bcryptjs |
| Rate limit | `express-rate-limit` (login e consulta de capa) |
| Cron | `node-cron` (backups automáticos 18:30 e 23:45) |

### Frontend (`frontend/`)

| Camada | Tecnologia |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Estilo | Tailwind CSS 3 + Radix UI (dialogs, selects, tabs, switch) + Lucide React |
| Formulários | React Hook Form + Zod resolvers |
| Rotas | React Router 6 |
| HTTP | Axios (`src/services/axios.ts`) |

### UI/UX

Metodologia UI Architect ASJ: canvas `#F2F2F0`, primary `#087F8C`, superfícies creme, hairline, motion refinado. Tokens em Tailwind (`tailwind.config`).

## Estrutura de diretórios

```
backend/
  prisma/
    schema.prisma        Modelos do banco
    seed.ts              Bootstrap estrutural (config + admin via env)
  scripts/
    smoke.ts             Suite E2E via API (58 casos)
    dedupe-books.ts      Utilitário de deduplicação de ISBN
  src/
    server.ts            Bootstrap HTTP
    app.ts               Montagem dos routers, CORS, handlers de erro
    validation.ts        Todos os schemas Zod + helpers (CPF, ISBN)
    lib/
      prisma.ts          Cliente Prisma
      http-error.ts      HttpError (status + message)
      audit.ts           writeAudit()
      settings.ts        getSettings() (regras de empréstimo)
      overdue.ts         refreshOverdue(), expireReservations(), computeDueDate()
      cover.ts           Resolução de capa na Amazon (ISBN → capa/dados)
    middleware/
      auth.ts            signToken(), requireAuth, requireRoles
      login-rate-limit.ts
      cover-rate-limit.ts
      error-handler.ts   notFoundHandler + errorHandler
      async-handler.ts
    modules/             Um router por domínio (ver docs/modulos.md)
  backups/               Backups do banco (.sqlite)

frontend/
  src/
    app/router/          Rotas (routes.tsx) e guardas (guards.tsx)
    components/
      layout/            AdminLayout, PublicLayout
      ui/                Botões, badges, dialogs, toast, spinners...
    features/
      api.ts             Clientes por entidade (booksApi, loansApi, ...)
      auth/              auth-provider (login/logout, sessão)
    pages/               Páginas públicas e do admin (ver docs/modulos.md)
    services/
      axios.ts           Instância axios + interceptor JWT + logout em 401
    types/api.ts         Tipos das entidades da API
```

## Fluxo de dados

1. A SPA chama os clientes de `features/api.ts` (ex.: `loansApi.createBatch`).
2. O interceptor de `services/axios.ts` injeta `Authorization: Bearer <token>` do `localStorage` (`livraria_token`).
3. O Express roteia para o módulo correspondente (`app.ts` monta `/api/<recurso>`).
4. O corpo/query é validado com Zod (`parse`); falha → `400` com `{ error }`.
5. A rota executa a regra de negócio via Prisma (SQLite), geralmente em `$transaction`.
6. Toda mutação registra auditoria (`writeAudit`).
7. Erros conhecidos viram `HttpError`; o `errorHandler` devolve `{ error }` com status apropriado.
8. Em `401` (não no login), o interceptor do axios limpa o token e emite `auth:unauthorized`, que desconecta a sessão.

## Autenticação e sessão

- `POST /api/auth/login` valida e-mail/senha (bcrypt), emite JWT assinado com `sub` (id do usuário) e `role`, expiração padrão **8 horas** (`JWT_EXPIRES`).
- Para evitar enumeração de e-mail, compara a senha contra um hash dummy quando o usuário não existe.
- `requireAuth` verifica o JWT e **consulta o banco** a cada requisição: usuário deve existir e estar `ACTIVE`.
- `requireRoles(...)` restringe a rota a determinados papéis.
- Logout não revoga o token (sessão stateless); apenas registra auditoria. A revogação efetiva ocorre ao expirar ou ao usuário ser desativado (o `requireAuth` rejeita usuários `INACTIVE`).

## RBAC

| Papel | Acesso |
|---|---|
| `ADMIN` | Tudo: dashboard, livros, empréstimos, devoluções, reservas, leitores, autores, categorias, relatórios, usuários, configurações, auditoria, backup |
| `ATTENDANT` | Dashboard, livros, empréstimos, devoluções, reservas, leitores, autores (consulta/criação) — **sem** usuários, relatórios, configurações, auditoria, categorias (escrita), backup |

Aplicação no backend: `requireRoles('ADMIN')` em users, categories (escrita), reports, audit, settings (PUT). No frontend: guarda `RequireAdmin` envolve essas rotas.

## Auditoria

- `writeAudit(userId, action, entity, entityId, metadata, ip)` grava em `AuditLog`; falha de escrita não derruba a operação (log de erro).
- Ações registradas: `LOGIN`, `LOGOUT`, `LOGIN_FAILED`, `USER_CREATED`, `USER_UPDATED`, `USER_PASSWORD_RESET`, `BOOK_CREATED`, `BOOK_UPDATED`, `BOOK_ARCHIVED`, `BOOK_RESTORED`, `AUTHOR_CREATED`, `AUTHOR_UPDATED`, `AUTHOR_ACTIVATED`, `AUTHOR_INACTIVATED`, `CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_STATUS_CHANGED`, `READER_CREATED`, `READER_UPDATED`, `READER_STATUS_CHANGED`, `LOAN_CREATED`, `LOAN_RETURNED`, `LOAN_RENEWED`, `RESERVATION_CREATED`, `RESERVATION_CANCELLED`, `RESERVATION_FULFILLED`, `SETTINGS_UPDATED`.
- Consulta: `GET /api/audit` (ADMIN) com filtros por ação, usuário e período.

## Backups

- Backups automáticos: `node-cron` agenda dois horários diários (18:30 e 23:45).
- Mecanismo: `VACUUM INTO` (SQLite 3.27+) — seguro com escritas concorrentes.
- Armazenamento: `backend/backups/` com arquivos `backup_YYYY-MM-DD_HH-mm.sqlite`.
- Rotação: mantém apenas os 5 backups mais recentes; os antigos são deletados automaticamente.
- Restauração: `POST /api/backups/:filename/restore` copia o arquivo sobre `dev.db` (requer restart do servidor).
- Endpoints protegidos: `requireAuth` + `requireRoles('ADMIN')` em todas as rotas.

## Rate limits

| Rota | Janela | Limite | Observação |
|---|---|---|---|
| `POST /api/auth/login` | 15 min | 10 tentativas | In-memory; reset ao reiniciar o servidor |
| `GET /api/books/cover` | 15 min | 30 consultas | Protege o scrap da Amazon |

## CORS

`app.ts` aceita `CORS_ORIGIN` (lista separada por vírgula); padrão `http://localhost:5173`.

## Tratamento de erros

Formato padrão de erro: `{ "error": "<mensagem>" }`.

| Situação | Status |
|---|---|
| Validação Zod (corpo ou query) | 400 |
| `HttpError` lançado pela regra de negócio | status próprio (400/401/403/404/409) |
| Prisma `P2002` (duplicado, ex.: ISBN) | 409 |
| Prisma `P2025` (registro inexistente) | 404 |
| Prisma `P2003` (FK inválida) | 400 |
| JSON malformado no corpo | 400 |
| Rota inexistente (`notFoundHandler`) | 404 |
| Qualquer outro | 500 |

## Consistência de prazos (overdue/reservas)

- `refreshOverdue()` marca como `OVERDUE` empréstimos `ACTIVE` com `dueDate` vencida e sem devolução. Roda em: `GET /loans`, `GET /loans/search`, `POST /loans`, `POST /loans/batch`, `POST /loans/:id/return`, `GET /readers/:id`, `GET /dashboard`, `GET /reports`.
- `expireReservations()` marca como `EXPIRED` reservas `PENDING` vencidas (`expiresAt` = 3 dias). Roda em: `GET /reservations`, `GET /loans`, `GET /loans/search`.

## Ambiente

### Backend (`backend/.env`)

```
DATABASE_URL="file:./dev.db"
JWT_SECRET=<segredo forte>
JWT_EXPIRES=8h            # opcional
ADMIN_NAME=Administrador   # opcional
ADMIN_EMAIL=voce@dominio.com
ADMIN_PASSWORD=sua-senha
CORS_ORIGIN=http://localhost:5173   # opcional, lista separada por vírgula
```

> O seed **não cria usuário** sem `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Sem credenciais padrão — ver docs/regras-de-negocio.md.

### Frontend (`frontend/.env`)

```
VITE_API_URL=http://localhost:3333/api   # opcional; padrão '/api' (proxy)
```

## Notas

- Buscas textuais no SQLite (Prisma `contains`) são case-sensitive: CPF, números e títulos devem ser digitados conforme cadastrados.
- Senhas com bcryptjs (compatível com bcrypt, sem dependência nativa no Windows).
- Comparação de nomes de autores para reaproveitamento é case-insensitive e feita em memória (o SQLite não suporta filtro `mode: 'insensitive'` no Prisma).