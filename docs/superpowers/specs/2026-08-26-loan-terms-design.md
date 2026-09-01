# Spec: Termos de Empréstimo e Devolução

**Data**: 2026-08-26
**Status**: Aprovado

## Objetivo

Gerar documentos oficiais (PDF) para cada empréstimo e devolução, preservando snapshots dos dados no momento da operação. Os documentos devem ser visualizáveis, imprimíveis e baixáveis posteriormente.

## Decisões de design

- **PDF**: Backend com `pdfkit` (gera dinamicamente, sem armazenar arquivo)
- **Snapshot**: Dados do leitor/livro/servidor salvos no `Loan` no momento do empréstimo
- **Acesso aos documentos**: Na página de detalhes do leitor, na seção de histórico de empréstimos
- **Dados da devolução**: Campos de condição e observações no modal de confirmação

## Schema — Snapshot fields no Loan

Campos adicionados ao model `Loan` no Prisma:

```prisma
model Loan {
  // ... campos existentes ...

  // Snapshots do empréstimo (preenchidos na criação)
  readerNameSnapshot     String?
  bookTitleSnapshot      String?
  bookAuthorSnapshot     String?    // autores separados por vírgula
  bookIsbnSnapshot       String?
  bookNumberSnapshot     String?    // número/tombo do livro
  createdByNameSnapshot  String?    // nome do servidor

  // Dados da devolução (preenchidos no retorno)
  returnCondition        String?    // BOM, REGULAR, DANIFICADO
  returnObservations     String?
  receivedByNameSnapshot String?    // nome do servidor que recebeu
}
```

### Snapshot preenchimento

No `POST /loans` e `POST /loans/batch`:
- `readerNameSnapshot` ← `reader.name`
- `bookTitleSnapshot` ← `book.title`
- `bookAuthorSnapshot` ← autores do livro (join por vírgula)
- `bookIsbnSnapshot` ← `book.isbn13 ?? book.isbn10`
- `bookNumberSnapshot` ← `book.id` (tombo)
- `createdByNameSnapshot` ← `user.name`

No `POST /loans/:id/return`:
- `returnCondition` ← do body (opcional)
- `returnObservations` ← do body (opcional)
- `receivedByNameSnapshot` ← `user.name`

## Schema — Validação

Novo schema na `validation.ts`:

```ts
export const loanReturnSchema = z.object({
  condition: z.enum(['BOM', 'REGULAR', 'DANIFICADO']).optional(),
  observations: z.string().trim().max(500).optional(),
});
```

## Backend — Endpoints de PDF

### `GET /api/loans/:id/term`

Gera e retorna o **Termo de Empréstimo** como PDF.

- Usa snapshots do Loan (não consulta relações atuais)
- Settings.libraryName no cabeçalho
- Content-Type: application/pdf
- Content-Disposition: inline; filename="termo-emprestimo-EMP-000123.pdf"

**Conteúdo do PDF:**
1. Cabeçalho: nome da biblioteca (Setting.libraryName)
2. Título: "TERMO DE EMPRÉSTIMO"
3. Número do empréstimo
4. Data/hora da operação (createdAt)
5. Dados do leitor: nome, código (id)
6. Dados do livro: título, autor, ISBN, código/tombo
7. Data do empréstimo, previsão de devolução
8. Responsável pelo atendimento (createdByNameSnapshot)
9. Área de assinatura do leitor
10. Área de assinatura do responsável

### `GET /api/loans/:id/return-term`

Gera e retorna o **Termo de Devolução** como PDF.

- Só disponível se `returnedAt` não é null
- 404 se o empréstimo não foi devolvido
- Content-Type: application/pdf

**Conteúdo do PDF:**
1. Cabeçalho: nome da biblioteca
2. Título: "TERMO DE DEVOLUÇÃO"
3. Número do empréstimo
4. Número da devolução (DEV-{loanId com 6 dígitos})
5. Dados do leitor (snapshot)
6. Dados do livro (snapshot)
7. Data do empréstimo, previsão, devolução efetiva
8. Dias do empréstimo (diferença entre loanDate e returnedAt)
9. Situação: "Dentro do prazo" ou "Atrasado ({n} dias)"
10. Condição do livro (returnCondition ou "Não informado")
11. Observações (se houver)
12. Responsável pelo recebimento (receivedByNameSnapshot)
13. Área de assinatura

### PDF Layout

```
┌─────────────────────────────────────────────┐
│           BIBLIOTECA PÚBLICA                │
│         (nome da instituição)               │
│                                             │
│         TERMO DE EMPRÉSTIMO                 │
│                                             │
│  Empréstimo nº: EMP-000123                  │
│  Data/Hora: 26/08/2026 12:15               │
│                                             │
│  LEITOR                                     │
│  Nome: João da Silva                        │
│  Código: LTR-000128                         │
│                                             │
│  LIVRO                                      │
│  Título: Dom Casmurro                       │
│  Autor: Machado de Assis                    │
│  ISBN: 9788535910663                        │
│  Código/Tombo: #4521                        │
│                                             │
│  Data do empréstimo: 26/08/2026             │
│  Previsão de devolução: 09/09/2026          │
│                                             │
│  Responsável: Maria Souza                   │
│                                             │
│  _______________________                    │
│  Assinatura do Leitor                       │
│                                             │
│  _______________________                    │
│  Responsável pelo atendimento               │
└─────────────────────────────────────────────┘
```

## Frontend — Integração

### Após criação de empréstimo

O `POST /loans` já retorna o empréstimo completo. Após sucesso:
1. Toast de sucesso (já existe)
2. Adicionar botão "Ver Termo" no toast ou em um mini-banner que abre `GET /loans/:id/term` em nova aba

### Modal de devolução expandido

O `ConfirmDialog` atual de devolução ganha `children` com dois campos:
- Select "Condição do livro": Bom estado / Regular / Danificado
- Textarea "Observações" (opcional)

Esses campos são enviados no body do `POST /loans/:id/return`.

### Detalhes do leitor — seção de empréstimos

Na tabela de empréstimos do leitor (`/admin/leitores/:id`):
- Coluna "Ações" ganha botões de documento:
  - Empréstimo ativo/atrasado: ícone de documento → `window.open('/api/loans/:id/term')`
  - Empréstimo devolvido: dois ícones — "Termo Empréstimo" + "Termo Devolução"

### Botão de download

O endpoint de PDF já retorna `Content-Disposition: inline` para visualização.
Para download, o frontend abre em nova aba — o navegador oferece "Salvar como" naturalmente.

## Auditoria

A geração de PDFs não registra auditoria separada (é operação de leitura).
A auditoria existente (`LOAN_CREATED`, `LOAN_RETURNED`) já cobre a operação.

## Migrations

1. `prisma db push` para adicionar os novos campos ao Loan
2. Campos são nullable — empréstimos antigos funcionam sem snapshot (PDF mostra "N/A" nos campos ausentes)

## Dependência

- `pdfkit` + `@types/pdfkit` no backend

## Arquivos afetados

### Backend
- `prisma/schema.prisma` — novos campos no Loan
- `src/validation.ts` — `loanReturnSchema`
- `src/modules/loan.routes.ts` — snapshot no create, dados no return, 2 novas rotas PDF
- `src/app.ts` — (não muda, rotas já no loanRouter)
- `package.json` — pdfkit

### Frontend
- `src/types/api.ts` — novos campos no tipo Loan
- `src/features/api.ts` — `loansApi.return` aceita condition/observations
- `src/pages/admin/reader-details.tsx` — botões de documento na tabela de empréstimos
- `src/pages/admin/returns.tsx` — modal expandido com campos de condição/observações
- `src/pages/admin/loans.tsx` — (sem mudança significativa)
