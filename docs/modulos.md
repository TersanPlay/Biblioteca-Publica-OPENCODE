# Módulos

## Backend — routers (`backend/src/modules/`)

| Módulo | Arquivo | Prefixo | Auth no módulo |
|---|---|---|---|
| Auth | `auth.routes.ts` | `/api/auth` | login público; me/logout exigem auth |
| Users | `user.routes.ts` | `/api/users` | ADMIN (módulo inteiro) |
| Books | `book.routes.ts` | `/api/books` | leitura pública; escrita com auth |
| Authors | `author.routes.ts` | `/api/authors` | auth |
| Categories | `category.routes.ts` | `/api/categories` | leitura pública; escrita ADMIN |
| Readers | `reader.routes.ts` | `/api/readers` | auth |
| Loans | `loan.routes.ts` | `/api/loans` | auth |
| Reservations | `reservation.routes.ts` | `/api/reservations` | auth |
| Reports | `report.routes.ts` | `/api/reports` | ADMIN |
| Audit | `audit.routes.ts` | `/api/audit` | ADMIN |
| Settings | `settings.routes.ts` | `/api/settings` | GET público; PUT ADMIN |
| Dashboard | `dashboard.routes.ts` | `/api/dashboard` | auth |
| Backup | `backup.routes.ts` | `/api/backups` | ADMIN (módulo inteiro) |

### Helpers de domínio

- `loan.routes.ts` — `assertBookEligible` (validação de livro para empréstimo, reutilizada no empréstimo individual e no lote), `ensureNumber` (gera `EMP-000123`).
- `book.routes.ts` — `resolveAuthorNames` (find-or-create de autores dentro da transação), `findDuplicateBook`/`duplicateConflict` (ISBN duplicado).
- `lib/overdue.ts` — `refreshOverdue`, `expireReservations`, `computeDueDate`, `addDays`.
- `lib/settings.ts` — `getSettings()` (regras + dados institucionais; defaults estruturais sem dados de demonstração).
- `lib/cover.ts` — `resolveAmazonCover` (scrap da Amazon por ISBN), `isbn13To10`.
- `lib/audit.ts` — `writeAudit`.
- `backup.routes.ts` — `createBackup` (VACUUM INTO), `rotateBackups` (mantém 5), `startBackupCrons` (18:30 e 23:45).

## Frontend — rotas (`src/app/router/routes.tsx`)

### Públicas (layout `PublicLayout`, sem login)

| Rota | Página |
|---|---|
| `/` | Home |
| `/catalogo` | Catálogo de livros (busca, categoria, disponibilidade) |
| `/livros/:id` | Detalhe do livro público |

### Autenticadas (guarda `RequireAuth` + `AdminLayout`)

| Rota | Página | Guarda extra |
|---|---|---|
| `/admin` | Dashboard (métricas, empréstimos recentes, devoluções, atrasados, top livros) | — |
| `/admin/livros` | Lista de livros | — |
| `/admin/livros/novo` | Formulário de livro (com capa por ISBN, autores por vírgula) | — |
| `/admin/livros/:id/editar` | Formulário de livro (edição) | — |
| `/admin/emprestimos` | Lista de empréstimos | — |
| `/admin/emprestimos/novo` | Novo empréstimo (1 ou vários livros) | — |
| `/admin/devolucoes` | Devolução (busca rápida por número/leitor/livro) | — |
| `/admin/reservas` | Reservas (cancelar/atender) | — |
| `/admin/leitores` | Lista de leitores | — |
| `/admin/leitores/:id` | Detalhe do leitor (bloquear/desbloquear, histórico) | — |
| `/admin/autores` | Autores | `RequireAdmin` |
| `/admin/categorias` | Categorias | `RequireAdmin` |
| `/admin/relatorios` | Relatórios (9 tipos + exportar CSV) | `RequireAdmin` |
| `/admin/usuarios` | Usuários do sistema | `RequireAdmin` |
| `/admin/configuracoes` | Configurações (limites + dados institucionais) | `RequireAdmin` |
| `/admin/auditoria` | Trilha de auditoria | `RequireAdmin` |
| `/admin/backup` | Backup & Restauração | `RequireAdmin` |

### Outras

| Rota | Página |
|---|---|
| `/login` | Login |
| `*` | 404 |

### Guardas (`src/app/router/guards.tsx`)

- `RequireAuth` — redireciona a `/login` sem sessão; mostra spinner enquanto carrega.
- `RequireAdmin` — exige `role === 'ADMIN'`; redireciona atendente para `/admin`.

## Frontend — camadas

### `src/services/axios.ts`
Instância axios com `baseURL` = `VITE_API_URL || '/api'`; injeta token do `localStorage` (`livraria_token`) e, em resposta `401` (fora do login), limpa o token e emite `auth:unauthorized` para desconectar a sessão.

### `src/features/`
- `api.ts` — clientes por entidade: `booksApi`, `authorsApi`, `categoriesApi`, `readersApi`, `loansApi` (inclui `createBatch`), `reservationsApi`, `reportsApi`, `usersApi`, `auditApi`, `settingsApi`, `dashboardApi`, `backupsApi`. Payloads limpos (campos vazios removidos); livro converte `BookFormValues` → `{ authorIds, authorNames }`.
- `auth/auth-provider.tsx` — estado de sessão (login/logout, persistência do token).

### `src/components/`
- `layout/admin-layout.tsx`, `layout/public-layout.tsx`.
- `ui/` — botões, badges de status (empréstimo, leitor, reserva), dialogs, selects, tabs, switch, toast, spinners.

### `src/pages/`
Uma página por rota (ver tabelas acima), em `pages/public/`, `pages/admin/`, `pages/auth/`.

### `src/types/api.ts`
Tipos das entidades (`Book`, `Loan`, `Reader`, `Reservation`, `User`, `Category`, `Author`, `AuditLog`, `ReportResult`, `LibrarySettings`, `DashboardData`, `Backup`, `Paginated<T>` etc.).