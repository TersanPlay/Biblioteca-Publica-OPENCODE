# Spec: Módulo BlockList (Bloqueio/Desbloqueio de Leitores)

## Visão geral

Página dedicada `/admin/blocklist` na seção "Comunidade" da sidebar, exibindo leitores bloqueados com motivo, data, responsável e ações de desbloqueio individual e em lote. Regra de bloqueio automático: leitor com 2+ empréstimos atrasados é bloqueado automaticamente.

## Contexto

O sistema já possui bloqueio/desbloqueio funcional:
- `PATCH /readers/:id/status` aceita `status: BLOCKED`
- `ReaderDetailsPage` tem botões bloquear/desbloquear
- `ReadersPage` tem filtro "Bloqueados"
- Regras de negócio impedem bloqueados de emprestar, renovar e reservar

Este módulo adiciona: página dedicada, motivo do bloqueio, regra automática, e desbloqueio em lote.

---

## 1. Schema (Prisma)

Adicionar campos ao model `Reader`:

```prisma
model Reader {
  // ...campos existentes...
  blockReason   String?
  blockCategory String?    // ATRASO_REPETIDO | COMPORTAMENTO | SOLICITACAO | OUTRO
  blockedAt     DateTime?
  blockedBy     Int?
  blockedByUser User?      @relation("BlockedReaders", fields: [blockedBy], references: [id])
}
```

Adicionar relação no model `User`:

```prisma
model User {
  // ...campos existentes...
  blockedReaders Reader[] @relation("BlockedReaders")
}
```

**Migration:** `npx prisma db push` (SQLite, sem migrar dados existentes).

**Motivo de não usar tabela separada:** O histórico completo de bloqueios/desbloqueios já fica no `AuditLog` (ação `READER_STATUS_CHANGED`). Os campos no `Reader` são apenas o estado atual.

---

## 2. Backend

### 2.1 Novo endpoint: `GET /api/readers/blocked`

**Rota:** `GET /api/readers/blocked`
**Auth:** `requireAuth`
**Descrição:** Retorna leitores com `status: BLOCKED`, incluindo dados do bloqueio.

**Query params:**
- `page` (padrão 1)
- `pageSize` (padrão 10, máx 100)
- `search` (nome, CPF)

**Resposta:**
```json
{
  "items": [
    {
      "id": 7,
      "name": "João Silva",
      "cpf": "12345678901",
      "email": "joao@email.com",
      "phone": "11999998888",
      "status": "BLOCKED",
      "blockReason": "Atrasos repetidos",
      "blockCategory": "ATRASO_REPETIDO",
      "blockedAt": "2026-08-20T14:30:00.000Z",
      "blockedByName": "Administrador",
      "activeLoans": 2
    }
  ],
  "total": 5,
  "page": 1,
  "pageSize": 10,
  "totalPages": 1
}
```

### 2.2 Modificar: `PATCH /readers/:id/status`

Aceitar campos opcionais extras no body:

```typescript
{
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED',
  reason?: string,     // Motivo do bloqueio
  category?: string    // ATRASO_REPETIDO | COMPORTAMENTO | SOLICITACAO | OUTRO
}
```

**Ao bloquear (`status: BLOCKED`):**
- Gravar `blockReason`, `blockCategory`, `blockedAt = now()`, `blockedBy = req.user.id`

**Ao desbloquear (`status: ACTIVE`):**
- Limpar `blockReason`, `blockCategory`, `blockedAt`, `blockedBy`

**Auditoria:** manter `READER_STATUS_CHANGED` com metadata incluindo `reason` e `category`.

### 2.3 Regra de bloqueio automático

**Trigger:** `POST /loans/:id/return` (devolução)

**Lógica:**
```typescript
// Após marcar empréstimo como RETURNED:
const overdueCount = await tx.loan.count({
  where: { readerId: loan.readerId, status: 'OVERDUE' }
});
if (overdueCount >= 2) {
  await tx.reader.update({
    where: { id: loan.readerId },
    data: {
      status: 'BLOCKED',
      blockCategory: 'ATRASO_REPETIDO',
      blockReason: 'Bloqueado automaticamente por atrasos repetidos',
      blockedAt: new Date(),
      blockedBy: null  // sistema
    }
  });
  // Cancelar reservas PENDING do leitor
  await tx.reservation.updateMany({
    where: { readerId: loan.readerId, status: 'PENDING' },
    data: { status: 'CANCELLED' }
  });
  // Auditoria
  await writeAudit(null, 'READER_STATUS_CHANGED', 'Reader', loan.readerId, {
    status: 'BLOCKED',
    reason: 'Bloqueado automaticamente por atrasos repetidos',
    category: 'ATRASO_REPETIDO',
    auto: true
  }, req.ip);
}
```

**Nota:** `refreshOverdue()` já marca empréstimos como `OVERDUE`. A verificação de bloqueio automático roda apenas na devolução (quando o status do empréstimo muda para `RETURNED`), não em consultas.

---

## 3. Frontend

### 3.1 Nova página: `pages/admin/blocklist.tsx`

**Rota:** `/admin/blocklist`
**Guarda:** `RequireAuth` (admin e atendente veem; só admin desbloqueia)

**Layout:**
- `PageHeader` com título "BlockList" e contagem de bloqueados
- Campo de busca (nome/CPF)
- Tabela com colunas:
  - Nome
  - CPF
  - Bloqueado em (data formatada)
  - Motivo (badge: Atraso repetido / Comportamento / Solicitação / Outro)
  - Bloqueado por (nome do usuário ou "Sistema")
  - Ações: Desbloquear (só admin)
- Checkbox para seleção em lote + botão "Desbloquear selecionados" (só admin)
- Paginação
- Empty state: "Nenhum leitor bloqueado"

**Modal de confirmação de desbloqueio:**
- Título: "Desbloquear leitor"
- Descrição: "{nome} voltará a poder realizar empréstimos."
- Botão: "Desbloquear"

### 3.2 Modal de bloqueio atualizado

Na `ReaderDetailsPage` e em qualquer UI de bloqueio, adicionar campos:

```tsx
<Select
  label="Motivo do bloqueio"
  options={[
    { value: 'ATRASO_REPETIDO', label: 'Atraso repetido' },
    { value: 'COMPORTAMENTO', label: 'Comportamento inadequado' },
    { value: 'SOLICITACAO', label: 'Solicitação administrativa' },
    { value: 'OUTRO', label: 'Outro' },
  ]}
/>
<Textarea
  label="Detalhes (opcional)"
  placeholder="Descreva o motivo do bloqueio..."
/>
```

### 3.3 Sidebar

Adicionar item na seção "Comunidade" do `admin-layout.tsx`:

```typescript
{
  to: '/admin/blocklist',
  label: 'BlockList',
  icon: Ban,        // importar de lucide-react
  adminOnly: false  // atendente pode ver
}
```

Posição: após "Leitores", antes de "Relatórios".

### 3.4 Rotas

Adicionar em `routes.tsx`:

```tsx
<Route path="admin/blocklist" element={<BlockListPage />} />
```

Dentro do bloco `<RequireAuth>`, fora do `<RequireAdmin>` (atendente pode acessar).

### 3.5 API client

Adicionar em `features/api.ts`:

```typescript
export const readersApi = {
  // ...métodos existentes...
  blocked: (params?: Params) =>
    api.get<Paginated<BlockedReader>>('/readers/blocked', { params }).then((r) => r.data),
  block: (id: number, reason?: string, category?: string) =>
    api.patch<Reader>(`/readers/${id}/status`, { status: 'BLOCKED', reason, category }).then((r) => r.data),
  unblock: (id: number) =>
    api.patch<Reader>(`/readers/${id}/status`, { status: 'ACTIVE' }).then((r) => r.data),
  unblockBatch: (ids: number[]) =>
    Promise.all(ids.map((id) => api.patch(`/readers/${id}/status`, { status: 'ACTIVE' }))),
};
```

### 3.6 Tipos

Adicionar em `types/api.ts`:

```typescript
export interface BlockedReader extends Reader {
  blockReason: string | null;
  blockCategory: string | null;
  blockedAt: string | null;
  blockedByName: string | null;
}
```

---

## 4. Permissões

| Ação | ADMIN | ATTENDANT |
|------|-------|-----------|
| Ver BlockList (`GET /readers/blocked`) | ✅ | ✅ |
| Buscar/filtrar | ✅ | ✅ |
| Desbloquear individual | ✅ | ❌ |
| Desbloquear em lote | ✅ | ❌ |
| Bloquear manual (com motivo) | ✅ | ✅ |
| Bloqueio automático (sistema) | automático | automático |

---

## 5. Seed e dados existentes

- **Sem alteração no seed:** bloqueios existentes ficam sem motivo/data (campos `NULL`)
- **Dados existentes:** leitores já bloqueados terão `blockReason: null`, `blockedAt: null` — a UI mostra "Motivo não informado" quando nulo

---

## 6. Auditoria

Ações relevantes já registradas:
- `READER_STATUS_CHANGED` — registro de bloqueio/desbloqueio (manual ou automático)
- Metadata inclui: `{ status, reason, category, auto? }`

---

## 7. Testes

### Backend (smoke.ts)
- Criar leitor, bloquear com motivo → verificar campos preenchidos
- Desbloquear → verificar campos limpos
- Criar 2 empréstimos com status OVERDUE, devolver → verificar bloqueio automático
- `GET /readers/blocked` → retorna leitores bloqueados com dados corretos
- Atendente não pode desbloquear → 403

### Frontend
- Navegar para `/admin/blocklist` → tabela carrega
- Buscar por nome → filtra corretamente
- Desbloquear leitor → remove da lista
- Selecionar múltiplos + desbloquear em lote → todos removidos
- Atendente não vê botão de desbloquear

---

## 8. Arquivos afetados

### Novos
- `frontend/src/pages/admin/blocklist.tsx`

### Modificados
- `backend/prisma/schema.prisma` (campos no Reader, relação no User)
- `backend/src/modules/reader.routes.ts` (novo endpoint, modificar PATCH)
- `backend/src/modules/loan.routes.ts` (bloqueio automático na devolução)
- `frontend/src/components/layout/admin-layout.tsx` (item na sidebar)
- `frontend/src/app/router/routes.tsx` (nova rota)
- `frontend/src/features/api.ts` (métodos blocked, block, unblockBatch)
- `frontend/src/types/api.ts` (tipo BlockedReader)
- `frontend/src/pages/admin/reader-details.tsx` (modal com motivo)
