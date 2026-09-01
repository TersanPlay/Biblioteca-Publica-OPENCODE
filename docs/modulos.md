# Módulos

## Backend — routers (`backend/src/modules/`)

| Módulo | Arquivo | Prefixo | Auth no módulo |
|---|---|---|---|
| Auth | `auth.routes.ts` | `/api/auth` | login público; me/logout exigem auth |
| Users | `user.routes.ts` | `/api/users` | ADMIN (módulo inteiro) |
| Books | `book.routes.ts` | `/api/books` | leitura pública; escrita com auth |
| Authors | `author.routes.ts` | `/api/authors` | auth |
| Subjects | `subject.routes.ts` | `/api/subjects` | leitura pública; escrita ADMIN |
| Knowledge Areas | `knowledge-area.routes.ts` | `/api/knowledge-areas` | leitura pública |
| Readers | `reader.routes.ts` | `/api/readers` | auth (DELETE: ADMIN) |
| Loans | `loan.routes.ts` | `/api/loans` | auth |
| Reservations | `reservation.routes.ts` | `/api/reservations` | auth |
| Reports | `report.routes.ts` | `/api/reports` | ADMIN |
| Audit | `audit.routes.ts` | `/api/audit` | ADMIN |
| Settings | `settings.routes.ts` | `/api/settings` | GET público; PUT ADMIN |
| Dashboard | `dashboard.routes.ts` | `/api/dashboard` | auth |
| Backup | `backup.routes.ts` | `/api/backups` | ADMIN (módulo inteiro) |

### Helpers de domínio

- `loan.routes.ts` — `assertBookEligible` (validação de livro para empréstimo, reutilizada no empréstimo individual e no lote), `ensureNumber` (gera `EMP-000123`), `buildLoanSnapshots` (snapshots de dados do leitor/livro/usuário no momento do empréstimo).
- `book.routes.ts` — `resolveAuthorNames`, `resolveSubjectNames`, `resolveKnowledgeAreaNames` (find-or-create dentro da transação), `findDuplicateBook`/`duplicateConflict` (ISBN duplicado).
- `reader.routes.ts` — `DELETE /:id` com anonimização LGPD (substitui dados pessoais, cancela reservas pendentes, bloqueia exclusão se houver empréstimos ativos).
- `lib/overdue.ts` — `refreshOverdue`, `expireReservations`, `computeDueDate`, `addDays`.
- `lib/settings.ts` — `getSettings()` (regras + dados institucionais; defaults estruturais sem dados de demonstração).
- `lib/cover.ts` — `resolveAmazonCover` (scrap da Amazon por ISBN), `isbn13To10`.
- `lib/audit.ts` — `writeAudit`.
- `backup.routes.ts` — `createBackup` (exporta coleções Appwrite para JSON), `rotateBackups` (mantém 5), `startBackupCrons` (18:30 e 23:45), download e exclusão. Restauração manual indisponível (Appwrite é a fonte de dados).

## Frontend — rotas (`src/app/router/routes.tsx`)

### Públicas (layout `PublicLayout`, sem login)

| Rota | Página |
|---|---|
| `/` | Home |
| `/catalogo` | Catálogo de livros (busca, assunto, disponibilidade) |
| `/livros/:id` | Detalhe do livro público |
| `/arquitetura` | Arquitetura do sistema (visão geral, stack, estrutura, fluxo de dados) |

### Autenticadas (guarda `RequireAuth` + `AdminLayout`)

| Rota | Página | Guarda extra |
|---|---|---|
| `/admin` | Dashboard (métricas, empréstimos recentes, devoluções, atrasados, top livros) | — |
| `/admin/livros` | Lista de livros | — |
| `/admin/livros/novo` | Formulário de livro (com capa por ISBN, autores por vírgula, áreas de conhecimento) | — |
| `/admin/livros/:id/editar` | Formulário de livro (edição) | — |
| `/admin/emprestimos` | Lista de empréstimos | — |
| `/admin/emprestimos/novo` | Novo empréstimo (1 ou vários livros) | — |
| `/admin/devolucoes` | Devolução (busca rápida por número/leitor/livro) | — |
| `/admin/reservas` | Reservas (cancelar/atender) | — |
| `/admin/leitores` | Lista de leitores | — |
| `/admin/leitores/novo` | Formulário de leitor (criação) | — |
| `/admin/leitores/:id` | Detalhe do leitor (editar, bloquear/desbloquear, excluir, histórico) | — |
| `/admin/blocklist` | Lista de leitores bloqueados (busca, desbloqueio em lote) | — |
| `/admin/autores` | Autores | `RequireAdmin` |
| `/admin/assuntos` | Assuntos | `RequireAdmin` |
| `/admin/relatorios` | Relatórios (9 tipos + exportar CSV) | `RequireAdmin` |
| `/admin/usuarios` | Usuários do sistema | `RequireAdmin` |
| `/admin/configuracoes` | Configurações (limites + dados institucionais) | `RequireAdmin` |
| `/admin/auditoria` | Trilha de auditoria | `RequireAdmin` |
| `/admin/backup` | Backup (listar, criar, baixar, excluir) | `RequireAdmin` |

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
- `api.ts` — clientes por entidade: `booksApi`, `authorsApi`, `subjectsApi`, `knowledgeAreasApi`, `readersApi` (inclui `block`, `unblock`, `unblockBatch`, `setStatus`, `remove`, `blocked`), `loansApi` (inclui `createBatch`), `reservationsApi`, `reportsApi`, `usersApi`, `auditApi`, `settingsApi`, `dashboardApi`, `backupsApi` (inclui `list`, `create`, `download`, `remove`). Payloads limpos (campos vazios removidos); livro converte `BookFormValues` → `{ authorIds, authorNames, subjectIds, subjectNames, knowledgeAreaIds, knowledgeAreaNames }`.
- `auth/auth-provider.tsx` — estado de sessão (login/logout, persistência do token).
- `hooks/use-async-data.ts` — hook genérico para carregamento de dados com loading/error/refetch.

### `src/components/`
- `layout/admin-layout.tsx`, `layout/public-layout.tsx`.
- `ui/` — botões, badges de status (empréstimo, leitor, reserva), dialogs (inclui `ConfirmDialog` com `confirmDisabled`), selects, tabs, switch, toast, spinners, skeleton.

### `src/pages/`
Uma página por rota (ver tabelas acima), em `pages/public/`, `pages/admin/`, `pages/auth/`.

- `pages/admin/reader-form-dialog.tsx` — componente compartilhado para criação e edição de leitores.
- `pages/admin/reader-details.tsx` — detalhe do leitor com histórico de empréstimos, botões de documentos PDF (Termo de Empréstimo e Termo de Devolução via blob autenticado).
- `pages/admin/returns.tsx` — modal de devolução expandido com seletor de condição (BOM/REGULAR/DANIFICADO) e campo de observações/ocorrências.
- `pages/admin/blocklist.tsx` — lista de leitores bloqueados com busca e desbloqueio em lote.

### `src/types/api.ts`
Tipos das entidades (`Book`, `Loan`, `Reader`, `ReaderDetail`, `BlockedReader`, `Reservation`, `User`, `Subject`, `Author`, `KnowledgeArea`, `AuditLog`, `ReportResult`, `LibrarySettings`, `DashboardData`, `Backup`, `Paginated<T>` etc.).
