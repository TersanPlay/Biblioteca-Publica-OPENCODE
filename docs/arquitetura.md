# Arquitetura

## Visão geral

Aplicação web de duas camadas para gestão de biblioteca pública:

```
┌──────────────┐  HTTP/JSON  ┌───────────────────────────┐  node-appwrite  ┌─────────────┐
│   Frontend   │            │  Backend                  │  ─────────────► │   Appwrite  │
│ React + Vite │ ──────────► │ Express (dev) OU          │                 │  Databases  │
│        (Vercel)│ ◄────────── │  Appwrite Function (prod) │ ◄────────────── │    Auth     │
└──────────────┘  JWT Bearer └───────────────────────────┘                 └─────────────┘
   localhost:5173                localhost:3333/api  (dev)                     + Storage
```

- O frontend é uma SPA (Vite dev na porta 5173) com proxy `/api` → porta 3333 em desenvolvimento.
- O backend é o mesmo Express 4 em dois modos de execução:
  - **Desenvolvimento**: `src/server.ts` escuta na porta 3333 (rota base `/api`). Cron de backups local com `node-cron`.
  - **Produção**: `src/function.ts` é o entrypoint de uma **Appwrite Function** (Node runtime). O handler `serverless-http` traduz o contexto HTTP da Function para um evento AWS API Gateway v1 e embutir a resposta do Express num envelope JSON. Frontend aponta `VITE_API_URL` para o domínio da Function.
- O armazenamento e a autenticação ficam no **Appwrite** (client `node-appwrite`): `Databases` para as coleções do domínio, `Account`/`Users` para credenciais e **Storage** para backups.
- Autenticação da sessão própria: JWT assinado, enviado como `Authorization: Bearer <token>`.

## Stack

### Backend (`backend/`)

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js + TypeScript (executado com `tsx watch`; build CJS via `tsc`) |
| HTTP | Express 4 (dev) / Appwrite Function (`serverless-http` como adaptador; prod) |
| Dados + Auth | Appwrite Cloud (`node-appwrite`): Databases + Account/Users |
| Backup | Appwrite Storage (`node-appwrite` `Storage` + `InputFile.fromBuffer`) |
| Validação | Zod 3 (`src/validation.ts`) |
| Autenticação de sessão | JWT (`jsonwebtoken`) |
| PDF | `pdfkit` (geração de termos de empréstimo e devolução) |
| Rate limit | `express-rate-limit` (login e consulta de capa; **desligado em Function** — stateless) |
| Cron | `node-cron` (dev) / **Appwrite Function schedule trigger** (prod) |

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
  scripts/
    appwrite-ping.ts     Ping de conectividade com o Appwrite
    setup-appwrite.ts    Setup das coleções/atributos (schema) + bucket de backups
    seed-appwrite.ts     Seed: cria usuário admin no Appwrite Auth via env
    smoke.ts             Suite E2E via API (63 casos)
  src/
    server.ts            Bootstrap HTTP local (dev) + cron de backups
    function.ts          Entrypoint da Appwrite Function (serverless-http + schedule)
    app.ts               Montagem dos routers, CORS, handlers de erro
    validation.ts        Todos os schemas Zod + helpers (CPF, ISBN)
    lib/
      appwrite.ts        Cliente Appwrite + APPWRITE_* + storage + isFunctionRuntime()
      appwrite-function-bridge.ts  Traduz contexto req/res da Function ↔ evento it Gateway/Express
      store.ts           Data-access layer (listDocs/findDocBy/createDoc/... + COLLECTIONS)
      http-error.ts      HttpError (status + message)
      audit.ts           writeAudit()
      settings.ts        getSettings() (regras de empréstimo)
      overdue.ts         refreshOverdue(), expireReservations(), computeDueDate()
      cover.ts           Resolução de capa na Amazon (ISBN → capa/dados)
      terms.ts           Geração de PDFs: Termo de Empréstimo e Termo de Devolução (pdfkit)
    middleware/
      auth.ts            signToken(), requireAuth, requireRoles
      login-rate-limit.ts
      cover-rate-limit.ts
      error-handler.ts   notFoundHandler + errorHandler
      async-handler.ts
    modules/             Um router por domínio (ver docs/modulos.md)

frontend/
  src/
    app/router/          Rotas (routes.tsx) e guardas (guards.tsx)
    components/
      layout/            AdminLayout, PublicLayout
      ui/                Botões, badges, dialogs (ConfirmDialog), toast, spinners...
    features/
      api.ts             Clientes por entidade (booksApi, loansApi, readersApi, backupsApi, ...)
      auth/              auth-provider (login/logout, sessão)
      hooks/             use-async-data (carregamento genérico com loading/error/refetch)
    pages/               Páginas públicas e do admin (ver docs/modulos.md)
    services/
      axios.ts           Instância axios + interceptor JWT + adapter Appwrite Function
    types/api.ts         Tipos das entidades da API
```

## Fluxo de dados

1. A SPA chama os clientes de `features/api.ts` (ex.: `loansApi.createBatch`).
2. O interceptor de `services/axios.ts` injeta `Authorization: Bearer <token>` do `localStorage` (`livraria_token`).
3. O Express roteia para o módulo correspondente (`app.ts` monta `/api/<recurso>`).
4. O corpo/query é validado com Zod (`parse`); falha → `400` com `{ error }`.
5. A rota executa a regra de negócio via a camada de dados `lib/store.ts`, que acessa as coleções Appwrite.
6. Toda mutação registra auditoria (`writeAudit`).
7. Erros conhecidos viram `HttpError`; o `errorHandler` devolve `{ error }` com status apropriado.
8. Em `401` (não no login), o interceptor do axios limpa o token e emite `auth:unauthorized`, que desconecta a sessão.

## Autenticação e sessão

- `POST /api/auth/login` valida credenciais no **Appwrite Auth** (`account.createEmailPasswordSession`) e, em seguida, no documento da collection `users` (por `appwriteUserId`) busca os metadados `role`/`status`. Emite JWT assinado com `sub` (id do doc em `users`) e `role`, expiração padrão **8 horas** (`JWT_EXPIRES`).
- Se o documento `users` ainda não existir (primeiro acesso), ele é autoprovido com role `ADMIN` a partir do usuário criado no Appwrite Auth pelo seed.
- Credenciais inválidas → `401` genérico "E-mail ou senha inválidos" (evita enumeração de e-mail); a tentativa é registrada em auditoria (`LOGIN_FAILED`).
- `requireAuth` verifica o JWT e **consulta a collection `users`** a cada requisição: usuário deve existir e estar `ACTIVE`.
- `requireRoles(...)` restringe a rota a determinados papéis.
- Logout não revoga o token (sessão stateless); apenas registra auditoria. A revogação efetiva ocorre ao expirar ou ao usuário ser desativado (o `requireAuth` rejeita usuários `INACTIVE`).

## RBAC

| Papel | Acesso |
|---|---|
| `ADMIN` | Tudo: dashboard, livros, empréstimos, devoluções, reservas, leitores, autores, assuntos, relatórios, usuários, configurações, auditoria, backup |
| `ATTENDANT` | Dashboard, livros, empréstimos, devoluções, reservas, leitores, autores (consulta/criação), blocklist — **sem** usuários, relatórios, configurações, auditoria, assuntos (escrita), backup |

Aplicação no backend: `requireRoles('ADMIN')` em users, subjects (escrita), reports, audit, settings (PUT), reader DELETE. No frontend: guarda `RequireAdmin` envolve essas rotas.

## Auditoria

- `writeAudit(userId, action, entity, entityId, metadata, ip)` grava um documento na collection `auditLogs`; falha de escrita não derruba a operação (log de erro).
- Ações registradas: `LOGIN`, `LOGOUT`, `LOGIN_FAILED`, `USER_CREATED`, `USER_UPDATED`, `USER_PASSWORD_RESET`, `BOOK_CREATED`, `BOOK_UPDATED`, `BOOK_ARCHIVED`, `BOOK_RESTORED`, `AUTHOR_CREATED`, `AUTHOR_UPDATED`, `AUTHOR_ACTIVATED`, `AUTHOR_INACTIVATED`, `SUBJECT_CREATED`, `SUBJECT_UPDATED`, `SUBJECT_STATUS_CHANGED`, `READER_CREATED`, `READER_UPDATED`, `READER_STATUS_CHANGED`, `READER_DELETED`, `LOAN_CREATED`, `LOAN_RETURNED`, `LOAN_RENEWED`, `RESERVATION_CREATED`, `RESERVATION_CANCELLED`, `RESERVATION_FULFILLED`, `SETTINGS_UPDATED`.
- Consulta: `GET /api/audit` (ADMIN) com filtros por ação, usuário e período.

## Backups

- Backups automáticos:
  - **Dev**: `node-cron` agenda dois horários diários (18:30 e 23:45) em `server.ts`.
  - **Produção (Function)**: trigger de schedule da Appwrite Function chama `createBackup()`. `function-entry` (`src/function.ts`) detecta `context.trigger === 'schedule'` e roda o backup. Cron local não agendado em Function (stateless).
- Mecanismo: exporta **todas as coleções Appwrite** para um arquivo JSON (`{ exportedAt, source: 'appwrite', collections: {...} }`) e envia ao **Appwrite Storage** (`InputFile.fromBuffer`) no bucket `biblioteca-backups`.
- Rotação: mantém apenas os 5 backups mais recentes; os antigos são deletados automaticamente (`rotateBackups`).
- Download: `GET /api/backups/:filename/download` — baixa o arquivo do Storage (`getFileDownload`) e envia como attachment.
- **Restauração manual indisponível**: o Appwrite é a fonte de dados, então `POST /api/backups/:filename/restore` retorna `400` ("Restauração manual indisponível: o Appwrite é a fonte de dados."). Não há upload de restauração (`multer` foi removido).
- Exclusão: `DELETE /api/backups/:filename` — remove o arquivo do Storage; registra auditoria `BACKUP_DELETED`.
- Endpoints protegidos: `requireAuth` + `requireRoles('ADMIN')` em todas as rotas.

## Rate limits

| Rota | Janela | Limite | Observação |
|---|---|---|---|
| `POST /api/auth/login` | 15 min | 10 tentativas | In-memory; reset ao reiniciar o servidor |
| `GET /api/books/cover` | 15 min | 30 consultas | Protege o scrap da Amazon |

- Os limiters vivem em `middleware/login-rate-limit.ts` e `middleware/cover-rate-limit.ts`.
- **Em Appwrite Function o rate-limit é desligado automaticamente** (`isFunctionRuntime()` — detecta `APPWRITE_FUNCTION_ID` no ambiente): o contador em memória não faz sentido em execução stateless e quebraria o login em produção.

## CORS

`app.ts` aceita `CORS_ORIGIN` (lista separada por vírgula); padrão `http://localhost:5173`.

## Tratamento de erros

Formato padrão de erro: `{ "error": "<mensagem>" }`.

| Situação | Status |
|---|---|
| Validação Zod (corpo ou query) | 400 |
| `HttpError` lançado pela regra de negócio | status próprio (400/401/403/404/409) |
| Appwrite `document_already_exists` / `user_already_exists` (duplicado, ex.: ISBN/CPF) | 409 |
| Appwrite `document_not_found` / `user_not_found` (registro inexistente) | 404 |
| Appwrite code `401` / `403` | 401 / 403 |
| JSON malformado no corpo | 400 |
| Rota inexistente (`notFoundHandler`) | 404 |
| Qualquer outro (incl. Appwrite genérico) | 500 |

## Consistência de prazos (overdue/reservas)

- `refreshOverdue()` marca como `OVERDUE` empréstimos `ACTIVE` com `dueDate` vencida e sem devolução. Roda em: `GET /loans`, `GET /loans/search`, `POST /loans`, `POST /loans/batch`, `POST /loans/:id/return`, `GET /readers/:id`, `GET /dashboard`, `GET /reports`.
- `expireReservations()` marca como `EXPIRED` reservas `PENDING` vencidas (`expiresAt` = 3 dias). Roda em: `GET /reservations`, `GET /loans`, `GET /loans/search`.

## Ambiente

### Backend (`backend/.env`)

```
APPWRITE_ENDPOINT="https://fra.cloud.appwrite.io/v1"
APPWRITE_PROJECT_ID=<id-do-projeto>
APPWRITE_DATABASE_ID=biblioteca
APPWRITE_API_KEY=<api-key-do-console>  # scopes: databases, users, storage
APPWRITE_BACKUP_BUCKET_ID=biblioteca-backups  # criado pelo appwrite:setup
JWT_SECRET=<segredo forte>
JWT_EXPIRES=8h            # opcional
ADMIN_EMAIL=voce@dominio.com
ADMIN_PASSWORD=sua-senha
CORS_ORIGIN=http://localhost:5173   # opcional, lista separada por vírgula
```

> O seed **não cria usuário** sem `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Sem credenciais padrão — ver docs/regras-de-negocio.md.

### Frontend (`frontend/.env`)

```
VITE_API_URL=https://biblioteca-publica-opencode.appwrite.network/api   # produção: domínio da Function
VITE_API_URL=http://localhost:3333/api   # opcional; padrão '/api' (proxy) em dev
```

> Quando `VITE_API_URL` é URL completa (`http(s)://`), o axios usa o **adapter de Appwrite Function**
> (`services/axios.ts`): chama o domínio da Function com `?type=json` e desempacota o envelope
> `{status, headers, body, isBase64Encoded}`. Binários (PDF/blob) vêm base64 e são reconvertidos.

## Deployment (produção)

### 1. Appwrite Function (backend)

1. Build: `cd backend && npx tsc` gera `dist/` (entrypoint: `dist/src/function.js`, CommonJS).
2. No Console Appwrite → Functions → Criar:
   - **Runtime**: Node (nativo), entrypoint `dist/src/function.js`.
   - **Build command** (quando o Console permite): `npm install && npm run build` (ou subir build pronto em `dist/`).
   - **Variáveis** (mesmas do `.env`, exceto as de seed):
     - `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_DATABASE_ID`
     - `JWT_SECRET` (mesmo valor usado para emitir os JWT), `CORS_ORIGIN` (domínio Vercel)
     - `APPWRITE_BACKUP_BUCKET_ID`
   - **Permissões/Scopes**: databases, users, storage.
   - **Timeout**: compatible com a rota mais lenta (ex.: consulta de capa pode passar de 15s).
3. Deploy o código (CLI ou subindo `backend/` via Console).
4. **Schedule trigger** para backups automáticos (ex.: 0 18:30 UTC e 0 23:45 UTC). A Function detecta `context.trigger === 'schedule'` e chama `createBackup()`.
5. **Key dinâmica**: dentro da Function o runtime injeta `APPWRITE_FUNCTION_API_KEY` (escopos herdados) — não é preciso editar código.

> O domínio público da Function responde em `https://biblioteca-publica-opencode.appwrite.network`.
> Como o backend espera rotas montadas em `/api`, o frontend aponta `VITE_API_URL=<domínio>/api`.

### 2. Frontend (Vercel)

1. `VITE_API_URL=<domínio-da-function>/api` como env no Vercel.
2. Deploy padrão SPA (`frontend/vercel.json` já configura rewrite de fallback).
3. `CORS_ORIGIN` na Function deve incluir o domínio Vercel.

## Notas

- IDs das entidades são strings geradas pelo Appwrite (`$id`); relacionamentos usam estes IDs.
- Dados desnormalizados: em empréstimos, autores/assuntos/áreas dos livros e snapshots de leitor são armazenados inline no documento (ex.: `readerNameSnapshot`, `bookTitleSnapshot`, `authorNames`, `subjectNames`).
- Comparação de nomes de autores/assuntos/áreas para reaproveitamento é case-insensitive e feita em memória/na borda (normalização antes de consultar).
- `format` e `acquisitionType` são strings validadas por Zod na borda da API (sem enums nativos no Appwrite).
- `requireAuth` consulta a collection `users` a cada requisição (usuário deve existir e estar `ACTIVE`).
