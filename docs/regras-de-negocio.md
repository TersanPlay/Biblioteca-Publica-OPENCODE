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

Novo prazo: `base + defaultLoanDays`, onde `base` = `dueDate` atual (se ainda futura) ou hoje (se vencida). `renewals` incrementa.

## Devolução

- `400` se já devolvida.
- Marca `RETURNED` e `returnedAt`.
- Se houver reserva `PENDING` para o livro (mais antiga), ela vira `AVAILABLE` (aguardando retirada) — ou `EXPIRED` se `expiresAt` já passou.

## Reserva

- Leitor deve estar `ACTIVE`; bloqueado/inativo não reserva.
- Não pode haver reserva ativa (PENDING/AVAILABLE) do mesmo leitor para o mesmo livro.
- `expiresAt` = criação + 3 dias; `PENDING` vencida → `EXPIRED` automaticamente (`expireReservations`).
- Atendimento (`fulfill`): cria o empréstimo em transação, validando de novo leitor ativo, livro livre e limite; reserva vira `FULFILLED`. Reserva cancelada/expirada não pode ser atendida.
- Devolução de livro com reserva PENDING a ativa como `AVAILABLE`.

## Autores com cadastro automático

- O formulário de livro aceita nomes separados por **vírgulas**.
- Ao salvar, cada nome é procurado no cadastro ignorando maiúsculas/minúsculas (comparação em memória, pois o SQLite não suporta `mode: 'insensitive'`).
  - Existe → reaproveita o autor (não cria duplicado).
  - Não existe → cria e registra auditoria `AUTHOR_CREATED`.
- Nome de autor: 2–120 caracteres.
- No update do livro, a relação de autores é **reatribuída** (remove e recria), então o formulário deve enviar a lista completa.
- Frontend: nomes digitados viram "chips"; chips de autores que serão criados aparecem destacados ("novo").

## Livros

- ISBN-10 e ISBN-13 validados com dígito verificador; normalizados (espaços/hífens removidos, maiúsculas).
- Duplicado por ISBN → `409` com detalhes do livro existente (`code: BOOK_ALREADY_EXISTS`).
- Capa: `GET /books/cover` consulta a Amazon Brasil (fallback .com) e extrai capa, título, subtítulo, ISBN-13, descrição, editora e ano; timeout de 12 s; rate limit 30/15 min.

## Leitores

- CPF validado com dígitos verificadores (11 dígitos, sem sequências repetidas).
- CPF único; e-mail único quando informado.
- Bloqueio manual pela tela de leitores; bloqueado não empresta, não renova, não reserva nem retira reserva.

## Usuários do sistema

- Papéis: `ADMIN` e `ATTENDANT`.
- Senha mínima de 6 caracteres; hash bcrypt (10 rounds).
- Usuário inativo não autentica (o `requireAuth` rejeita status ≠ `ACTIVE`).
- Primeiro acesso: criado no seed a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD` (não há credenciais padrão). Perfis adicionais são criados pela tela Usuários.

## Auditoria

Toda operação de escrita registra quem (usuário autenticado), o quê (ação), sobre qual entidade, com metadados e IP. Falhas de login também são registradas (sem usuário).

## Política anti-dados-mock

O sistema não exibe nem cria dados fictícios em produção: estados vazios reais ("Nenhum livro cadastrado"), sem credenciais demo, sem fallbacks inventados. Apenas fixtures de teste (smoke/CDP) criam dados, marcados como TEST e removidos ao final.