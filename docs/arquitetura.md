# Arquitetura

## Visão geral

Aplicação web de duas camadas para gestão de biblioteca pública:

```
┌──────────────┐   HTTP/JSON (axios)   ┌──────────────┐   node-appwrite   ┌─────────────┐
│  Frontend    │ ─────────────────────► │  Backend     │ ────────────────► │  Appwrite   │
│  React + Vite│ ◄───────────────────── │  Express API │ ◄──────────────── │  Databases  │
└──────────────┘        JWT Bearer      └──────────────┘      + Auth       └─────────────┘
   http://localhost:5173                   http://localhost:3333/api
```

- O frontend é uma SPA (Vite dev na porta 5173) com proxy `/api` → porta 3333 em desenvolvimento.
- O backend expõe uma API REST sob a URL base `/api` (porta 3333).
- O armazenamento e a autenticação ficam no **Appwrite** (client `node-appwrite`): `Databases` para as coleções do domínio e `Account`/`Users` para credenciais.
- Autenticação da sessão própria: JWT assinado, enviado como `Authorization: Bearer <token>`.

## Stack

### Backend (`backend/`)

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js + TypeScript (executado com `tsx watch`) |
| HTTP | Express 4 |
| Dados + Auth | Appwrite Cloud (`node-appwrite`): Databases + Account/Users |
| Validação | Zod 3 (`src/validation.ts`) |
| Autenticação de sessão | JWT (`jsonwebtoken`) |
| PDF | `pdfkit` (geração de termos de empréstimo e devolução) |
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
  scripts/
    appwrite-ping.ts     Ping de conectividade com o Appwrite
    setup-appwrite.ts    Setup das coleções/atributos (schema de dados)
    seed-appwrite.ts     Seed: cria usuário admin no Appwrite Auth via env
    smoke.ts             Suite E2E via API (63 casos)
  src/
    server.ts            Bootstrap HTTP
    app.ts               Montagem dos routers, CORS, handlers de erro
    validation.ts        Todos os schemas Zod + helpers (CPF, ISBN)
    lib/
      appwrite.ts        Cliente Appwrite + APPWRITE_* de ambiente
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
  backups/               Backups exportados em JSON (coleções Appwrite)

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
      axios.ts           Instância axios + interceptor JWT + logout em 401
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
| `ADMIN` | Tudo: dashboard, livros, empréstimos, devoluções, reservas, leitores, autores, categorias, relatórios, usuários, configurações, auditoria, backup |
| `ATTENDANT` | Dashboard, livros, empréstimos, devoluções, reservas, leitores, autores (consulta/criação), blocklist — **sem** usuários, relatórios, configurações, auditoria, categorias (escrita), backup |

Aplicação no backend: `requireRoles('ADMIN')` em users, categories (escrita), reports, audit, settings (PUT), reader DELETE. No frontend: guarda `RequireAdmin` envolve essas rotas.

## Auditoria

- `writeAudit(userId, action, entity, entityId, metadata, ip)` grava um documento na collection `auditLogs`; falha de escrita não derruba a operação (log de erro).
- Ações registradas: `LOGIN`, `LOGOUT`, `LOGIN_FAILED`, `USER_CREATED`, `USER_UPDATED`, `USER_PASSWORD_RESET`, `BOOK_CREATED`, `BOOK_UPDATED`, `BOOK_ARCHIVED`, `BOOK_RESTORED`, `AUTHOR_CREATED`, `AUTHOR_UPDATED`, `AUTHOR_ACTIVATED`, `AUTHOR_INACTIVATED`, `CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_STATUS_CHANGED`, `READER_CREATED`, `READER_UPDATED`, `READER_STATUS_CHANGED`, `READER_DELETED`, `LOAN_CREATED`, `LOAN_RETURNED`, `LOAN_RENEWED`, `RESERVATION_CREATED`, `RESERVATION_CANCELLED`, `RESERVATION_FULFILLED`, `SETTINGS_UPDATED`.
- Consulta: `GET /api/audit` (ADMIN) com filtros por ação, usuário e período.

## Backups

- Backups automáticos: `node-cron` agenda dois horários diários (18:30 e 23:45).
- Mecanismo: exporta **todas as coleções Appwrite** para um arquivo JSON (`{ exportedAt, source: 'appwrite', collections: {...} }`). Como o Appwrite é a fonte de dados (não há banco local), o backup é um snapshot exportável.
- Armazenamento: `backend/backups/` com arquivos `backup_YYYY-MM-DD_HH-mm.json`.
- Rotação: mantém apenas os 5 backups mais recentes; os antigos são deletados automaticamente.
- Download: `GET /api/backups/:filename/download` — stream do arquivo via `res.download`.
- **Restauração manual indisponível**: o Appwrite é a fonte de dados, então `POST /api/backups/:filename/restore` retorna `400` ("Restauração manual indisponível: o Appwrite é a fonte de dados."). Não há upload de restauração (`multer` foi removido).
- Exclusão: `DELETE /api/backups/:filename` — remove o arquivo; registra auditoria `BACKUP_DELETED`.
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
APPWRITE_API_KEY=<api-key-do-console>
JWT_SECRET=<segredo forte>
JWT_EXPIRES=8h            # opcional
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

- IDs das entidades são strings geradas pelo Appwrite (`$id`); relacionamentos usam estes IDs.
- Dados desnormalizados: em empréstimos, autores/categorias/áreas dos livros e snapshots de leitor são armazenados inline no documento (ex.: `readerNameSnapshot`, `bookTitleSnapshot`, `authorNames`, `categoryNames`).
- Comparação de nomes de autores/categorias/áreas para reaproveitamento é case-insensitive e feita em memória/na borda (normalização antes de consultar).
- `format` e `acquisitionType` são strings validadas por Zod na borda da API (sem enums nativos no Appwrite).
- `requireAuth` consulta a collection `users` a cada requisição (usuário deve existir e estar `ACTIVE`).
