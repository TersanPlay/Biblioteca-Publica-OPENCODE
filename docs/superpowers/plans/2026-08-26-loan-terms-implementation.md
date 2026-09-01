# Termos de Empréstimo e Devolução — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar PDFs oficiais (Termo de Empréstimo + Termo de Devolução) com snapshots de dados, acessíveis na página de detalhes do leitor.

**Architecture:** Snapshots no model Loan + pdfkit para geração de PDF + endpoints GET /loans/:id/term e /return-term + UI no reader-details e returns.

**Tech Stack:** Prisma, pdfkit, Express, React, Zod

## Global Constraints

- SQLite (sem enums do Prisma — valores como String com validação Zod)
- Snapshot preserva dados no momento da operação (não consulta relações atuais no PDF)
- PDF gerado dinamicamente (sem armazenar arquivo)
- Campos nullable (empréstimos antigos funcionam sem snapshot)

---

### Task 1: Schema + Migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Run: `npx prisma db push`

**Steps:**

- [ ] Adicionar campos snapshot ao model Loan no schema.prisma:

```prisma
model Loan {
  // ... campos existentes ...

  readerNameSnapshot     String?
  bookTitleSnapshot      String?
  bookAuthorSnapshot     String?
  bookIsbnSnapshot       String?
  bookNumberSnapshot     String?
  createdByNameSnapshot  String?
  returnCondition        String?
  returnObservations     String?
  receivedByNameSnapshot String?
}
```

- [ ] Rodar `npx prisma db push` e verificar "Database is in sync"
- [ ] Rodar `npx tsc --noEmit` no backend
- [ ] Commit

---

### Task 2: Validação + Snapshot no Loan Create

**Files:**
- Modify: `backend/src/validation.ts` — adicionar `loanReturnSchema`
- Modify: `backend/src/modules/loan.routes.ts` — snapshot no create, body no return

**Steps:**

- [ ] Adicionar `loanReturnSchema` em validation.ts:

```ts
export const loanReturnSchema = z.object({
  condition: z.enum(['BOM', 'REGULAR', 'DANIFICADO']).optional(),
  observations: z.string().trim().max(500).optional(),
});
```

- [ ] Em `loan.routes.ts`, na transação do POST /loans, adicionar snapshot ao criar:

```ts
const readerSnapshot = reader.name;
const bookSnapshot = book.title;
const authorSnapshot = /* buscar autores e join por vírgula */;
const isbnSnapshot = book.isbn13 ?? book.isbn10 ?? null;
const userSnapshot = (await tx.user.findUnique({ where: { id: userId } }))?.name ?? null;

const created = await tx.loan.create({
  data: {
    readerId: reader.id,
    bookId: data.bookId,
    userId,
    dueDate,
    status: 'ACTIVE',
    readerNameSnapshot: readerSnapshot,
    bookTitleSnapshot: bookSnapshot,
    bookAuthorSnapshot: authorSnapshot,
    bookIsbnSnapshot: isbnSnapshot,
    bookNumberSnapshot: String(book.id),
    createdByNameSnapshot: userSnapshot,
  },
});
```

- [ ] Fazer o mesmo para o POST /loans/batch (dentro do loop)
- [ ] No POST /loans/:id/return, aplicar loanReturnSchema e preencher campos de devolução:

```ts
const data = parse(loanReturnSchema, req.body ?? {});

const returned = await prisma.loan.update({
  where: { id },
  data: {
    returnedAt: new Date(),
    status: 'RETURNED',
    returnCondition: data.condition ?? null,
    returnObservations: data.observations ?? null,
    receivedByNameSnapshot: req.user!.name,
  },
});
```

- [ ] tsc --noEmit
- [ ] Commit

---

### Task 3: Backend — PDF com pdfkit

**Files:**
- Create: `backend/src/lib/terms.ts`
- Modify: `backend/src/modules/loan.routes.ts` — 2 novas rotas
- Modify: `backend/package.json` — pdfkit

**Steps:**

- [ ] Instalar: `npm install pdfkit; npm install -D @types/pdfkit`

- [ ] Criar `backend/src/lib/terms.ts` com função `generateLoanTerm`:

```ts
import PDFDocument from 'pdfkit';
import type { Prisma } from '@prisma/client';

type LoanWithSnapshots = Prisma.LoanGetPayload<{}>;

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function generateLoanTermPDF(loan: LoanWithSnapshots, libraryName: string): PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Cabeçalho
  doc.fontSize(16).font('Helvetica-Bold').text(libraryName || 'BIBLIOTECA PÚBLICA', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).text('TERMO DE EMPRÉSTIMO', { align: 'center' });
  doc.moveDown(1);

  // Número e data
  doc.fontSize(11).font('Helvetica-Bold').text(`Empréstimo nº: ${loan.number || `EMP-${String(loan.id).padStart(6, '0')}`}`);
  doc.font('Helvetica').text(`Data/Hora: ${formatDateTime(loan.createdAt)}`);
  doc.moveDown(1);

  // Leitor
  doc.font('Helvetica-Bold').text('LEITOR');
  doc.font('Helvetica').text(`Nome: ${loan.readerNameSnapshot || 'N/A'}`);
  doc.text(`Código: LTR-${String(loan.readerId).padStart(6, '0')}`);
  doc.moveDown(1);

  // Livro
  doc.font('Helvetica-Bold').text('LIVRO');
  doc.font('Helvetica').text(`Título: ${loan.bookTitleSnapshot || 'N/A'}`);
  doc.text(`Autor: ${loan.bookAuthorSnapshot || 'N/A'}`);
  doc.text(`ISBN: ${loan.bookIsbnSnapshot || 'N/A'}`);
  doc.text(`Código/Tombo: #${loan.bookNumberSnapshot || String(loan.bookId)}`);
  doc.moveDown(1);

  // Datas
  doc.font('Helvetica-Bold').text('DATA DO EMPRÉSTIMO');
  doc.font('Helvetica').text(`Data do empréstimo: ${formatDate(loan.loanDate)}`);
  doc.text(`Previsão de devolução: ${formatDate(loan.dueDate)}`);
  doc.moveDown(1);

  // Responsável
  doc.font('Helvetica-Bold').text(`Responsável: ${loan.createdByNameSnapshot || 'N/A'}`);
  doc.moveDown(2);

  // Assinaturas
  doc.font('Helvetica').text('________________________________');
  doc.text('Assinatura do Leitor');
  doc.moveDown(1.5);
  doc.text('________________________________');
  doc.text('Responsável pelo atendimento');

  return doc;
}

export function generateReturnTermPDF(loan: LoanWithSnapshots, libraryName: string): PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const loanDays = loan.returnedAt
    ? Math.ceil((new Date(loan.returnedAt).getTime() - new Date(loan.loanDate).getTime()) / 86400000)
    : 0;
  const isOverdue = loan.returnedAt && new Date(loan.returnedAt) > new Date(loan.dueDate);
  const lateDays = isOverdue
    ? Math.ceil((new Date(loan.returnedAt!).getTime() - new Date(loan.dueDate).getTime()) / 86400000)
    : 0;

  // Cabeçalho
  doc.fontSize(16).font('Helvetica-Bold').text(libraryName || 'BIBLIOTECA PÚBLICA', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).text('TERMO DE DEVOLUÇÃO', { align: 'center' });
  doc.moveDown(1);

  // Números
  doc.fontSize(11).font('Helvetica-Bold').text(`Empréstimo nº: ${loan.number || `EMP-${String(loan.id).padStart(6, '0')}`}`);
  doc.font('Helvetica').text(`Devolução nº: DEV-${String(loan.id).padStart(6, '0')}`);
  doc.moveDown(1);

  // Leitor e Livro
  doc.font('Helvetica-Bold').text('LEITOR');
  doc.font('Helvetica').text(`Nome: ${loan.readerNameSnapshot || 'N/A'}`);
  doc.text(`Código: LTR-${String(loan.readerId).padStart(6, '0')}`);
  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').text('LIVRO');
  doc.font('Helvetica').text(`Título: ${loan.bookTitleSnapshot || 'N/A'}`);
  doc.text(`Autor: ${loan.bookAuthorSnapshot || 'N/A'}`);
  doc.text(`ISBN: ${loan.bookIsbnSnapshot || 'N/A'}`);
  doc.moveDown(1);

  // Datas
  doc.font('Helvetica-Bold').text('DATAS');
  doc.font('Helvetica').text(`Empréstimo: ${formatDate(loan.loanDate)}`);
  doc.text(`Previsão de devolução: ${formatDate(loan.dueDate)}`);
  doc.text(`Devolução efetiva: ${formatDate(loan.returnedAt!)}`);
  doc.text(`Dias de empréstimo: ${loanDays}`);
  doc.moveDown(0.5);

  // Situação
  doc.font('Helvetica-Bold').text('SITUAÇÃO');
  doc.font('Helvetica').text(isOverdue ? `Atrasado (${lateDays} dia(s))` : 'Devolvido dentro do prazo');
  doc.text(`Condição do livro: ${loan.returnCondition || 'Não informado'}`);
  if (loan.returnObservations) {
    doc.text(`Observações: ${loan.returnObservations}`);
  }
  doc.moveDown(1);

  // Responsável
  doc.font('Helvetica-Bold').text(`Responsável pelo recebimento: ${loan.receivedByNameSnapshot || 'N/A'}`);
  doc.moveDown(2);

  // Assinaturas
  doc.font('Helvetica').text('________________________________');
  doc.text('Assinatura do Leitor');
  doc.moveDown(1.5);
  doc.text('________________________________');
  doc.text('Responsável pelo recebimento');

  return doc;
}
```

- [ ] Adicionar rotas em loan.routes.ts:

```ts
import { generateLoanTermPDF, generateReturnTermPDF } from '../lib/terms';
import { getSettings } from '../lib/settings';

// GET /loans/:id/term
loanRouter.get(
  '/:id/term',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new HttpError(404, 'Empréstimo não encontrado');
    const settings = await getSettings();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="termo-emprestimo-${loan.number || `EMP-${String(loan.id).padStart(6, '0')}`}.pdf"`);
    const doc = generateLoanTermPDF(loan, settings.libraryName);
    doc.pipe(res);
    doc.end();
  }),
);

// GET /loans/:id/return-term
loanRouter.get(
  '/:id/return-term',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new HttpError(404, 'Empréstimo não encontrado');
    if (!loan.returnedAt) throw new HttpError(404, 'Empréstimo ainda não devolvido');
    const settings = await getSettings();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="termo-devolucao-DEV-${String(loan.id).padStart(6, '0')}.pdf"`);
    const doc = generateReturnTermPDF(loan, settings.libraryName);
    doc.pipe(res);
    doc.end();
  }),
);
```

- [ ] tsc --noEmit
- [ ] Commit

---

### Task 4: Frontend — Tipos + API

**Files:**
- Modify: `frontend/src/types/api.ts` — novos campos no Loan
- Modify: `frontend/src/features/api.ts` — loansApi.return aceita condition/observations

**Steps:**

- [ ] Atualizar interface Loan em types/api.ts:

```ts
export interface Loan {
  id: number;
  number: string | null;
  readerId: number;
  bookId: number;
  userId: number;
  loanDate: string;
  dueDate: string;
  returnedAt: string | null;
  renewals: number;
  notes: string | null;
  status: LoanStatus;
  readerNameSnapshot?: string | null;
  bookTitleSnapshot?: string | null;
  bookAuthorSnapshot?: string | null;
  bookIsbnSnapshot?: string | null;
  bookNumberSnapshot?: string | null;
  createdByNameSnapshot?: string | null;
  returnCondition?: string | null;
  returnObservations?: string | null;
  receivedByNameSnapshot?: string | null;
  reader?: Reader;
  book?: Book;
  user?: { id: number; name: string };
}
```

- [ ] Atualizar loansApi.return em features/api.ts:

```ts
return: (id: number, data?: { condition?: string; observations?: string }) =>
  api.post<Loan>(`/loans/${id}/return`, data).then((r) => r.data),
```

- [ ] tsc --noEmit no frontend
- [ ] Commit

---

### Task 5: Frontend — Modal de devolução expandido

**Files:**
- Modify: `frontend/src/pages/admin/returns.tsx`

**Steps:**

- [ ] Adicionar state para condition e observations
- [ ] Expandir o ConfirmDialog com children contendo select de condição e textarea de observações
- [ ] Enviar dados no confirmReturn

---

### Task 6: Frontend — Botões de documento no reader-details

**Files:**
- Modify: `frontend/src/pages/admin/reader-details.tsx`

**Steps:**

- [ ] Adicionar coluna "Documentos" na tabela de empréstimos
- [ ] Para empréstimo ativo: botão que abre `/api/loans/:id/term` em nova aba
- [ ] Para empréstimo devolvido: dois botões — Termo Empréstimo + Termo Devolução

---

### Task 7: Verificação final + commit

- [ ] tsc + build completo
- [ ] Smoke test (verificar que empréstimos antigos ainda funcionam)
- [ ] Commit final
