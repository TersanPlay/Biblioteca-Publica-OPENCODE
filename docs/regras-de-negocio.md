# Regras de negócio

## Configurações (tela Configurações / `Setting` id 1)

| Regra | Padrão | Faixa | Efeito |
|---|---|---|---|
| `loanLimit` | 4 | 1–20 | Máximo de empréstimos ativos (ACTIVE + OVERDUE) por leitor |
| `defaultLoanDays` | 15 | 1–90 | Prazo de devolução aplicado quando não informado |
| `maxRenewals` | 1 | 0–5 | Máximo de renovações por empréstimo |
| Instituição | vazio | — | Nome, endereço, telefone, e-mail, horário — preenchidos pelo usuário |

> Campos institucionais começam vazios e só aparecem na interface quando preenchidos (não há valores de demonstração).

## Status

### Leitor
`ACTIVE` | `INACTIVE` | `BLOCKED`

### Empréstimo
- `ACTIVE` — em aberto, dentro do prazo.
- `OVERDUE` — `ACTIVE` cuja `dueDate` passou sem devolução (marcado por `refreshOverdue`, disparado automaticamente nas consultas de empréstimos, dashboard, relatórios e detalhe do leitor).
- `RETURNED` — devolvido.

### Reserva
`PENDING` (aguardando) → `AVAILABLE` (livro devolvido, aguardando retirada) → `FULFILLED` (empréstimo criado) | `CANCELLED` | `EXPIRED` (3 dias após criação).

### Livro
`isArchived` — arquivamento é **soft delete**: o livro some das listagens mas permanece no banco; não pode ser emprestado enquanto arquivado.

## Empréstimo

1. Leitor deve existir e estar `ACTIVE` (bloqueado/inativo não empresta).
2. Leitor não pode ter empréstimo `OVERDUE` em aberto — "regularize antes de emprestar".
3. `ativos + novos ≤ loanLimit` (com a contagem de ativos recalculada).
4. Livro elegível: não arquivado, sem empréstimo ativo (`ACTIVE`/`OVERDUE`) e sem reserva `PENDING`/`AVAILABLE` de **outro** leitor. Mensagens citam o título do livro.
5. `dueDate` opcional; se informada, deve ser futura; senão `loanDate + defaultLoanDays`.
6. Número gerado: `EMP-` + id com 6 dígitos (ex.: `EMP-000123`).
7. Registra auditoria `LOAN_CREATED`.

### Snapshots de dados

No momento da criação do empréstimo, são salvos os dados do leitor, livro e usuário responsáveis como snapshots. Campos: `readerNameSnapshot`, `bookTitleSnapshot`, `bookAuthorSnapshot`, `bookIsbnSnapshot`, `bookNumberSnapshot`, `createdByNameSnapshot`. Esses snapshots são usados nos Termos PDF (documentos de empréstimo/devolução) para preservar o estado dos dados no momento do registro, mesmo que o leitor/livro sejam alterados depois.

Para empréstimos criados antes da implementação dos snapshots, os termos PDF fazem fallback para os dados das relações atuais (reader, book, user).

### Empréstimo em lote (`POST /loans/batch`)

- 1 a 20 livros por pedido; seleção sem duplicados.
- **Transação única**: se qualquer livro falhar (emprestado, reservado, arquivado), nenhum empréstimo é criado.
- Data de devolução única para todo o lote.
- Limite combinado: `ativos + selecionados ≤ loanLimit` (o frontend mostra "X de N disponíveis" no novo empréstimo).

## Renovação

Bloqueada quando (mensagem específica em cada caso):
- Empréstimo já devolvido (`RETURNED`/`returnedAt`).
- Empréstimo `OVERDUE` — atrasado não renova.
- Leitor bloqueado ou inativo.
- `renewals ≥ maxRenewals`.
- Existe reserva ativa (PENDING/AVAILABLE) para o livro.

Novo prazo: `base + defaultLoanDays`, onde `base` = `dueDate` atual (se ainda futura) ou hoje (se vencida). `renewals` incrementa. O snapshot do usuário que renovou é salvo em `renewedBySnapshot`.

## Devolução

- `400` se já devolvida.
- Marca `RETURNED` e `returnedAt`.
- Opcionalmente registra `returnCondition` (BOM/REGULAR/DANIFICADO) e `returnObservations`.
- Snapshot do responsável pela devolução: `receivedByNameSnapshot`.
- Se houver reserva `PENDING` para o livro (mais antiga), ela vira `AVAILABLE` (aguardando retirada) — ou `EXPIRED` se `expiresAt` já passou.

## Reserva

- Leitor deve estar `ACTIVE`; bloqueado/inativo não reserva.
- Não pode haver reserva ativa (PENDING/AVAILABLE) do mesmo leitor para o mesmo livro.
- `expiresAt` = criação + 3 dias; `PENDING` vencida → `EXPIRED` automaticamente (`expireReservations`).
- Atendimento (`fulfill`): cria o empréstimo em transação, validando de novo leitor ativo, livro livre e limite; reserva vira `FULFILLED`. Reserva cancelada/expirada não pode ser atendida.
- Devolução de livro com reserva PENDING a ativa como `AVAILABLE`.

## Autores com cadastro automático

- O formulário de livro aceita nomes separados por **vírgulas**.
- Ao salvar, cada nome é procurado no cadastro ignorando maiúsculas/minúsculas (normalização em memória/na borda antes da consulta).
  - Existe → reaproveita o autor (não cria duplicado).
  - Não existe → cria e registra auditoria `AUTHOR_CREATED`.
- Nome de autor: 2–120 caracteres.
- No update do livro, a relação de autores é **reatribuída** (remove e recria), então o formulário deve enviar a lista completa.
- Frontend: nomes digitados viram "chips"; chips de autores que serão criados aparecem destacados ("novo").

## Áreas de Conhecimento com cadastro automático

- O formulário de livro aceita nomes de áreas de conhecimento separados por **vírgulas**.
- Ao salvar, cada nome é procurado no cadastro (find-or-create case-insensitive).
  - Existe → reaproveita (não cria duplicado).
  - Não existe → cria (tabela `KnowledgeArea`).
- Relação N:N com livros via `BookKnowledgeArea`.
- No update, a relação é reatribuída (remove e recria).

## Livros

- ISBN-10 e ISBN-13 validados com dígito verificador; normalizados (espaços/hífens removidos, maiúsculas).
- Duplicado por ISBN → `409` com detalhes do livro existente (`code: BOOK_ALREADY_EXISTS`).
- Capa: `GET /books/cover` consulta a Amazon Brasil (fallback .com) e extrai capa, título, subtítulo, ISBN-13, descrição, editora e ano; timeout de 12 s; rate limit 30/15 min.
- Campos expandidos: `format` (CAPA/BROCHURA/ESPIRAL), `volume`, `cdd`, `cutter`, `physicalLocation`, `availableCopies`, `acquisitionType` (COMPRA/DOACAO/REPOSICAO/PRODUCAO_INTERNA/TROCA/EMPRESTIMO_BIBLIOTECAS/LICITACAO/PERMUTA/CONVENIO).
- Appwrite não suporta enums nativos: valores validados por Zod na borda da API, armazenados como String.

## Leitores

- CPF validado com dígitos verificadores (11 dígitos, sem sequências repetidas).
- CPF único; e-mail único quando informado.
- Bloqueio manual pela tela de leitores; bloqueado não empresta, não renova, não reserva nem retira reserva.
- Motivo e categoria de bloqueio registrados (`blockReason`, `blockCategory`, `blockedAt`, `blockedBy`).
- **Exclusão com anonimização LGPD** (`DELETE /readers/:id`, ADMIN apenas):
  - Bloqueia se houver empréstimos ativos ou em atraso.
  - Cancela reservas pendentes/disponíveis do leitor.
  - Substitui dados pessoais: nome → "Leitor excluído", CPF → "EXCLUIDO-{id}", demais campos → `null`.
  - Status → `INACTIVE`, registra `deletedAt` e `anonymizedAt`.
  - Registra auditoria `READER_DELETED` com referência ao ID original.

## Usuários do sistema

- Papéis: `ADMIN` e `ATTENDANT`.
- Senha mínima de 6 caracteres; hash gerenciado pelo Appwrite Auth (não armazenado na collection `users`).
- Usuário inativo não autentica (o `requireAuth` rejeita status ≠ `ACTIVE`).
- Primeiro acesso: criado no seed a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD` (não há credenciais padrão). Perfis adicionais são criados pela tela Usuários.

## Auditoria

Toda operação de escrita registra quem (usuário autenticado), o quê (ação), sobre qual entidade, com metadados e IP. Falhas de login também são registradas (sem usuário).

Ações registradas: `LOGIN`, `LOGOUT`, `LOGIN_FAILED`, `USER_CREATED`, `USER_UPDATED`, `USER_PASSWORD_RESET`, `BOOK_CREATED`, `BOOK_UPDATED`, `BOOK_ARCHIVED`, `BOOK_RESTORED`, `AUTHOR_CREATED`, `AUTHOR_UPDATED`, `AUTHOR_ACTIVATED`, `AUTHOR_INACTIVATED`, `SUBJECT_CREATED`, `SUBJECT_UPDATED`, `SUBJECT_STATUS_CHANGED`, `READER_CREATED`, `READER_UPDATED`, `READER_STATUS_CHANGED`, `READER_DELETED`, `LOAN_CREATED`, `LOAN_RETURNED`, `LOAN_RENEWED`, `RESERVATION_CREATED`, `RESERVATION_CANCELLED`, `RESERVATION_FULFILLED`, `SETTINGS_UPDATED`.

## Backup

- Backups automáticos: dois horários diários via `node-cron` (18:30 e 23:45).
- Mecanismo: exporta todas as coleções Appwrite para um arquivo JSON (`{ exportedAt, source: 'appwrite', collections }`).
- Armazenamento: `backend/backups/` com arquivos `backup_YYYY-MM-DD_HH-mm.json`.
- Rotação: mantém apenas os 5 backups mais recentes; os antigos são deletados automaticamente.
- **Download**: `GET /api/backups/:filename/download` — stream do arquivo real.
- **Restauração manual indisponível**: `POST /api/backups/:filename/restore` retorna `400` — o Appwrite é a fonte de dados; não há upload de restauração.
- **Exclusão**: `DELETE /api/backups/:filename` — remove o arquivo.
- Todas as rotas protegidas: `requireAuth` + `requireRoles('ADMIN')`.

## Política anti-dados-mock

O sistema não exibe nem cria dados fictícios em produção: estados vazios reais ("Nenhum livro cadastrado"), sem credenciais demo, sem fallbacks inventados. Apenas fixtures de teste (smoke/CDP) criam dados, marcados como TEST e removidos ao final.

## Termos de Empréstimo/Devolução (PDF)

### Geração

- **Termo de Empréstimo** (`GET /loans/:id/term`): dados do empréstimo, leitor, material bibliográfico, registro do atendimento e assinaturas.
- **Termo de Devolução** (`GET /loans/:id/return-term`): situação (prazo/atraso), condição do material, dados do empréstimo original, leitor, material, registro da devolução, responsável e assinaturas.

### Layout

- Cabeçalho institucional com ícone BookOpen, nome, endereço, telefone e e-mail da biblioteca.
- Título centralizado com número do termo destacado.
- Seções numeradas com bordas sutis e campos em 2-3 colunas.
- Predominantemente preto/cinza, cor institucional (#087F8C) apenas em pequenos elementos de destaque.
- Código de verificação (SHA-256 baseado no ID e data) no rodapé.
- Rodapé: data/hora de geração, número do empréstimo, registrado por.
- Numeração de páginas.

### Segurança

- Rotas de PDF exigem autenticação (`requireAuth` por rota).
- Frontend busca o PDF como blob via axios (com token JWT), cria blob URL e abre com `window.open`.
- Não existem rotas públicas de PDF.

### Disponibilidade

- Botões de documentos na página de detalhes do leitor (`/admin/leitores/:id`), na tabela de histórico de empréstimos.
- Termo de Devolução só disponível para empréstimos devolvidos (`returnedAt` preenchido).
