# Referência da API

URL base: `http://localhost:3333/api` (dev). Autenticação: `Authorization: Bearer <token>`.

Formato de resposta paginada:

```json
{ "items": [], "total": 0, "page": 1, "pageSize": 10, "totalPages": 0 }
```

Query de paginação (quando aplicável): `page` (≥1, padrão 1), `pageSize` (1–100, padrão 10).

Erros: sempre `{ "error": "<mensagem>" }` (ver docs/arquitetura.md → Tratamento de erros).

---

## Health

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/health` | — | `{ ok: true, service: 'livraria-api' }` |

## Auth

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | — | Login. Rate limit: 10/15 min. Retorna `{ token, user }` |
| GET | `/api/auth/me` | ✅ | Usuário autenticado (`{ user }`) |
| POST | `/api/auth/logout` | ✅ | Registra auditoria de logout; `{ ok: true }` |

`POST /login` — corpo: `{ email, password }`. Erros: `401` credenciais inválidas ou usuário inativo; `429` muitas tentativas.

## Users — `ADMIN` apenas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/users` | Lista paginada; filtros: `search` (nome/e-mail), `role` (ADMIN/ATTENDANT), `status` (ACTIVE/INACTIVE) |
| POST | `/api/users` | Cria usuário: `{ name, email, password (mín. 6), role? }`. `409` e-mail duplicado |
| GET | `/api/users/:id` | Detalhe (sem senha) |
| PUT | `/api/users/:id` | Atualiza `{ name?, email?, role?, status? }`; `409` e-mail duplicado |
| POST | `/api/users/:id/password` | Redefine senha: `{ password (mín. 6) }` |

## Books

Público para leitura; escrita exige autenticação.

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/books` | — | Lista paginada com `isAvailable` por livro |
| GET | `/api/books/cover` | — | Busca capa/dados na Amazon por ISBN. Rate limit: 30/15 min. `404` se não achar |
| GET | `/api/books/exists` | ✅ | Verifica ISBN cadastrado: `?isbn=&exclude=` → `{ book }` ou `{ book: null }` |
| GET | `/api/books/:id` | — | Detalhe + últimos 10 empréstimos + `hasActiveLoan` |
| POST | `/api/books` | ✅ | Cria livro (autores, assuntos e áreas de conhecimento por nome inclusos) |
| PUT | `/api/books/:id` | ✅ | Atualiza livro (autores, assuntos e áreas de conhecimento reatribuídos) |
| DELETE | `/api/books/:id` | ✅ | Arquiva (soft delete): `{ ok, isArchived: true }` |
| PATCH | `/api/books/:id/restore` | ✅ | Desarquiva: `{ ok, isArchived: false }` |

Query de `GET /books`: `search` (título, subtítulo, ISBN, editora, autor), `subjectId`, `availability` (`available`/`unavailable`), `format` (`CAPA`/`BROCHURA`/`ESPIRAL`), `sort` (`newest` [padrão]/`oldest`/`title`), `includeArchived` (bool).

`POST/PUT /books` — corpo:

```json
{
  "title": "Dom Casmurro",
  "subtitle": null,
  "isbn10": "8535910664",
  "isbn13": "9788535910663",
  "description": null,
  "publisher": "Companhia das Letras",
  "edition": 1,
  "publicationYear": 2008,
  "language": "pt-BR",
  "pages": 256,
  "coverUrl": null,
  "format": "CAPA",
  "volume": "Vol. 1",
  "cdd": "869.9",
  "cutter": "M338d",
  "physicalLocation": "Estante A",
  "availableCopies": 3,
  "acquisitionType": "COMPRA",
  "subjectIds": [3],
  "subjectNames": ["Ficção científica"],
  "authorIds": [1, 2],
  "authorNames": ["Machado de Assis"],
  "knowledgeAreaIds": [1],
  "knowledgeAreaNames": ["Ciências Humanas"]
}
```

- `authorNames` cria autores novos ao salvar (find-or-create case-insensitive); nomes existentes são reutilizados.
- `subjectIds`/`subjectNames` seguem o mesmo padrão (livro pode ter N assuntos — relação `BookSubject`).
- `knowledgeAreaIds`/`knowledgeAreaNames` seguem o mesmo padrão (livro pode ter N áreas de conhecimento — relação `BookKnowledgeArea`).
- `format`: `CAPA`, `BROCHURA` ou `ESPIRAL` (validado por Zod; armazenado como String).
- `acquisitionType`: `COMPRA`, `DOACAO`, `REPOSICAO`, `PRODUCAO_INTERNA`, `TROCA`, `EMPRESTIMO_BIBLIOTECAS`, `LICITACAO`, `PERMUTA` ou `CONVENIO`.
- ISBN normalizado (espaços/hífens removidos, dígito verificador validado).
- Livro duplicado por ISBN → `409` com `{ error, code: 'BOOK_ALREADY_EXISTS', duplicate: { id, titulo, isbn10, isbn13 } }`.
- `GET /books/cover?isbn=...` → `{ coverUrl, title, subtitle, isbn13, description, publisher, publicationYear }`.

## Knowledge Areas — leitura pública

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/knowledge-areas` | — | Lista todas as áreas de conhecimento (sem paginação) |

## Authors — autenticação

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/authors` | Paginado; filtros: `search`, `status` (`active`/`inactive`); `?all=1` lista ativos sem paginação |
| POST | `/api/authors` | Cria: `{ name, isActive? }` |
| PUT | `/api/authors/:id` | Atualiza `{ name, isActive? }` |
| PATCH | `/api/authors/:id/status` | `{ isActive: boolean }` — desativa/ativa |

## Subjects — leitura pública

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/subjects` | — | Ativas por padrão; `?all=1` inclui inativas (exige auth) |
| POST | `/api/subjects` | ADMIN | Cria `{ name, description? }` |
| PUT | `/api/subjects/:id` | ADMIN | Atualiza `{ name, description? }` |
| PATCH | `/api/subjects/:id/status` | ADMIN | `{ status: 'ACTIVE' | 'INACTIVE' }` |

## Readers — autenticação

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/readers` | ✅ | Paginado com `activeLoans` por leitor; filtros: `search` (nome/CPF/e-mail), `status` (ACTIVE/INACTIVE/BLOCKED/ALL [padrão]) |
| POST | `/api/readers` | ✅ | Cria (CPF validado com dígitos verificadores; `409` CPF/e-mail duplicado) |
| GET | `/api/readers/blocked` | ✅ | Lista de leitores bloqueados (paginado, com `activeLoans` e `blockedByName`); filtros: `search` |
| GET | `/api/readers/:id` | ✅ | Detalhe + empréstimos (últimos 50) + reservas (últimas 20) + `activeLoans` + `overdueCount` |
| PUT | `/api/readers/:id` | ✅ | Atualiza campos parciais |
| PATCH | `/api/readers/:id/status` | ✅ | `{ status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED', reason?, category? }` |
| DELETE | `/api/readers/:id` | ADMIN | Exclui leitor (anonimização LGPD): bloqueia se tiver empréstimos ativos, cancela reservas pendentes, substitui dados pessoais por valores genéricos. Corpo: `{ reason? }` |

Corpo de criação: `{ name, cpf, birthDate?, phone?, email?, cep?, address?, number?, neighborhood?, city?, state? }` (UF com 2 letras).

## Loans — autenticação

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/loans` | Paginado; filtros: `status` (ACTIVE [inclui OVERDUE]/OVERDUE/RETURNED/ALL), `readerId`, `start`, `end` (por `loanDate`), `search` (número, leitor nome/CPF, livro título/ISBN) |
| GET | `/api/loans/search` | `?q=` busca rápida entre ativos/atrasados (máx. 20) |
| POST | `/api/loans` | Empréstimo de 1 livro |
| POST | `/api/loans/batch` | Empréstimo de vários livros em transação única |
| GET | `/api/loans/:id` | Detalhe |
| POST | `/api/loans/:id/return` | Devolução (opcionalmente com `condition` e `observations`) |
| POST | `/api/loans/:id/renew` | Renovação |
| GET | `/api/loans/:id/term` | PDF do Termo de Empréstimo (autenticado via blob) |
| GET | `/api/loans/:id/return-term` | PDF do Termo de Devolução (autenticado via blob) |

`POST /loans` — corpo: `{ readerId, bookId, dueDate? }`. `POST /loans/batch` — corpo:

```json
{ "readerId": 7, "bookIds": [12, 34], "dueDate": "2026-09-01" }
```

`POST /loans/:id/return` — corpo (opcional):

```json
{ "condition": "BOM", "observations": "Material sem avarias" }
```

- `condition`: `BOM`, `REGULAR` ou `DANIFICADO`
- `observations`: texto livre (até 1000 caracteres)

Regras comuns (falha → `400` sem criar nada):
- Leitor deve existir e estar `ACTIVE`.
- Leitor sem empréstimo `OVERDUE` em aberto.
- `ativos + selecionados ≤ loanLimit` (configurado em Configurações).
- Livro não arquivado, sem empréstimo ativo e sem reserva pendente de **outro** leitor (mensagem inclui o título: `"X" já está emprestado`).
- `dueDate` deve ser futura; sem `dueDate`, usa `loanDate + defaultLoanDays`.
- Duplicados em `bookIds` → `400` "Livro duplicado na seleção".
- Batch: `bookIds` de 1 a 20; falha de qualquer livro aborta a transação inteira.

Respostas: `201` com o(s) empréstimo(s) completos (com `number` no formato `EMP-000123`, `reader`, `book`, `user`); batch retorna `{ items, count }`.

### Termos PDF

Rotas `GET /loans/:id/term` e `GET /loans/:id/return-term` geram PDFs com `pdfkit`. Requerem autenticação (`Authorization: Bearer <token>`). Frontend busca como blob e abre em nova aba.

O Termo de Empréstimo contém: dados do empréstimo, leitor (snapshots), material bibliográfico, registro do atendimento e assinaturas. O Termo de Devolução contém: situação (prazo/atraso), condição do material, dados do empréstimo original, leitor, material, registro da devolução, responsável e assinaturas.

## Reservations — autenticação

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/reservations` | Paginado; filtros: `status` (PENDING/AVAILABLE/FULFILLED/CANCELLED/EXPIRED/all [padrão]), `readerId`, `bookId`, `search` (nome do leitor) |
| POST | `/api/reservations` | Cria `{ readerId, bookId }` — `expiresAt` = +3 dias |
| POST | `/api/reservations/:id/cancel` | Cancela (não permite FULFILLED) |
| POST | `/api/reservations/:id/fulfill` | Atende: cria empréstimo em transação (valida leitor ACTIVE, livro livre e limite) |

- `400` se o leitor já tiver reserva ativa (PENDING/AVAILABLE) para o mesmo livro.
- `GET /reservations` dispara `expireReservations()` (PENDING vencidas → EXPIRED).
- Devolução de livro com reserva PENDING a transforma em `AVAILABLE` (ou `EXPIRED` se já vencida).

## Reports — `ADMIN` apenas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/reports` | Resultado `{ type, generatedAt, filters, columns, rows }` |
| GET | `/api/reports/export` | Mesmos filtros; baixa CSV (`;` como separador, BOM UTF-8) |

Parâmetros: `type` (obrigatório) + `start`, `end`, `subjectId`, `bookId`, `readerId`, `limit` (1–100, padrão 10).

| `type` | Colunas |
|---|---|
| `acervo` | Métrica/Valor (livros, arquivados, disponíveis, emprestados, assuntos, autores) |
| `available` | Título/ISBN (livros disponíveis) |
| `loaned` | Título/ISBN (livros emprestados) |
| `overdue` | Empréstimo/Leitor/Livro/Devido em |
| `loans-period` | Empréstimo/Leitor/Livro/Emprestado em (filtro por `loanDate`) |
| `returns-period` | Empréstimo/Leitor/Livro/Devolvido em (filtro por `returnedAt`) |
| `active-readers` | Leitor/CPF/Empréstimos no período |
| `top-books` | Livro/ISBN/Empréstimos |
| `subjects` | Assunto/Empréstimos |

## Audit — `ADMIN` apenas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/audit` | Paginado; filtros: `action`, `userId`, `start`, `end`; inclui usuário responsável |
| GET | `/api/audit/actions` | `{ actions: [...] }` — ações distintas já registradas |

## Settings

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/settings` | — | Configurações atuais (público; usado pelo catálogo) |
| PUT | `/api/settings` | ADMIN | Atualiza |

`PUT` — corpo: `{ loanLimit (1–20), defaultLoanDays (1–90), maxRenewals (0–5), libraryName, libraryAddress?, libraryPhone?, libraryEmail?, libraryHours? }`. Campos institucionais vazios até serem preenchidos pelo usuário.

## Dashboard — autenticação

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard` | `{ totalBooks, availableBooks, loanedBooks, activeReaders, activeLoans, overdueLoans, recentLoans[5], recentReturns[5], overdue[5], topBooks[5] }` (topBooks: últimos 30 dias) |

## Backup — `ADMIN` apenas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/backups` | Lista backups existentes (ordenados por data desc) |
| POST | `/api/backups` | Cria backup manual (exporta todas as coleções Appwrite para JSON). Rotação automática: mantém apenas 5 |
| GET | `/api/backups/:filename/download` | Baixa o arquivo de backup (stream via `res.download`) |
| POST | `/api/backups/:filename/restore` | **Indisponível** — retorna `400`: o Appwrite é a fonte de dados |
| DELETE | `/api/backups/:filename` | Remove backup |

`GET /backups` retorna:

```json
[
  { "filename": "backup_2026-08-21_18-30.json", "size": 53248, "createdAt": "2026-08-21T18:30:00.000Z" }
]
```

Backups automáticos: dois agendamentos diários via `node-cron` (18:30 e 23:45). Arquivos em `backend/backups/` como `backup_*.json` — snapshot de todas as coleções Appwrite (`{ exportedAt, source: 'appwrite', collections }`). Validação de `filename`: regex `^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.json$`. Não há upload/restauração manual (`multer` foi removido).

---

## Discrepâncias conhecidas frontend × backend

O frontend (`features/api.ts`) expõe chamadas para rotas que **não existem** no backend (retornariam 404):

| Chamada do frontend | Rota real no backend |
|---|---|
| `PATCH /authors/:id/deactivate` e `…/reactivate` | `PATCH /authors/:id/status` `{ isActive }` |
| `PATCH /subjects/:id/deactivate` e `…/reactivate` | `PATCH /subjects/:id/status` `{ status }` |
| `PATCH /users/:id/deactivate` e `…/reactivate` | Não existe; usar `PUT /users/:id` com `status` |
| `PATCH /reservations/:id/cancel` e `…/fulfill` | `POST /reservations/:id/cancel` e `POST /reservations/:id/fulfill` |

Impacto: os toggles de ativar/desativar usuários, autores e assuntos nas telas de admin, e as ações de cancelar/atender reserva na tela Reservas, falham com 404 se acionados. A documentação acima reflete a API real do backend.
