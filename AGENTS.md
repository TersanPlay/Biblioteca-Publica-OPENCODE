# Regras do Projeto

## Política anti-dados mock (regra permanente)

É proibido adicionar dados mock, fictícios, demonstrativos ou placeholders de negócio no código
de produção com a intenção de simular registros reais da aplicação.

### Proibido

- Arrays de dados fictícios dentro de componentes para preencher listagens, cards, gráficos ou dashboards.
- Credenciais de demonstração exibidas em interface (ex.: "admin@x.local / Senha1").
- Registros de seed que representem dados institucionais falsos (livros, leitores, empréstimos, contatos, horários).
- Fallbacks com valores inventados quando a API não retorna dados (ex.: `?? 'Biblioteca Pública Municipal'`).
- Valores aleatórios para simular métricas reais.
- Nomes/identidades fictícias como se fossem entidades reais da aplicação.

### Obrigatório

- Apenas API/banco de dados como fonte de dados em tempo de execução.
- Estados vazios reais ("Nenhum livro cadastrado", "Informações de contato não configuradas").
- Primeiro acesso do administrador via variáveis de ambiente (`ADMIN_EMAIL`/`ADMIN_PASSWORD`), sem credenciais padrão.
- Campos institucionais (nome, contato, horário) vazios até serem preenchidos pelo usuário nas Configurações.
- Placeholders de input (ex.: "Dom Casmurro") são exemplos de UX — aceitos quando claramente marcados como `placeholder`.

### Exceção

Fixtures de testes automatizados (`backend/scripts/smoke.ts`, testes unitários/e2e) podem criar
dados fictícios, desde que identificados como TEST e removidos ao final (best-effort).

### Verificação antes de dar tarefa por concluída

1. Os dados exibidos vêm de fonte real (API/banco)?
2. Estados vazios e de erro estão implementados?
3. Não há fallback fictício em caso de ausência de dados?
4. Não há credenciais demo expostas na UI ou no seed?

## Setup e execução

```bash
# Backend (porta 3333, /api)
cd backend
npm install                # roda prisma generate automaticamente (postinstall)
cp .env.example .env        # se existir; caso contrário crie com JWT_SECRET obrigatório
npm run db:setup            # prisma db push + seed (não usa migrations)
npm run dev                 # tsx watch src/server.ts

# Frontend (porta 5173, proxy /api -> 3333)
cd frontend
npm install
npm run dev                 # vite
```

**Obrigatório no `backend/.env` antes do primeiro `db:setup`:**
- `JWT_SECRET` — sem isso o servidor não inicia (exit fatal em `src/server.ts:7`).
- `ADMIN_EMAIL` + `ADMIN_PASSWORD` — seed não cria admin sem elas.

## Comandos úteis

| Comando | O que faz |
|---|---|
| `cd backend && npm run smoke` | Suite E2E via API (58 casos). Requer backend em 3333. Fixtures TEST removidas ao final. |
| `cd backend && npx tsc --noEmit` | Typecheck backend |
| `cd frontend && npm run build` | `tsc -b` + `vite build` (valida tipos e build) |
| `cd backend && npm run db:dedupe` | Deduplica livros por ISBN |

Não há `lint`/`format`/`pre-commit` configurados no repo.

## Arquitetura rápida

- **Monorepo simples**: `backend/` (Express + Prisma + SQLite) e `frontend/` (React + Vite).
- Backend entrypoint: `backend/src/server.ts` → `backend/src/app.ts` (monta routers em `/api/<recurso>`).
- Frontend entrypoint: `frontend/src/main.tsx` → `frontend/src/app/router/routes.tsx`.
- Banco: SQLite arquivo (`backend/prisma/dev.db`). Schema em `prisma/schema.prisma`. Mudanças no schema exigem `npm run db:push` (não há migrations versionadas).
- Frontend é ESM (`"type": "module"`), backend é CommonJS.

## Convenções que quebram defaults

- **Prisma `db push`**, não `prisma migrate`. `npm run db:setup` recria o schema do zero.
- **bcryptjs**, não `bcrypt` (sem dependência nativa).
- **Zod** usado no backend para validar corpo/query; falha → `400` com `{ error }`.
- Formato de erro padrão da API: `{ "error": "<mensagem>" }`.
- Backend consulta o banco a cada requisição autenticada (`requireAuth` em `src/middleware/auth.ts`) — não há cache de sessão.
- JWT expira em 8h por padrão; logout não revoga token (revogação efetiva só na expiração ou desativação do usuário).
- Token JWT armazenado no `localStorage` como `livraria_token`; interceptor axios injeta `Authorization: Bearer`. Em 401 (exceto login), o interceptor limpa o token e emite `auth:unauthorized`.

## RBAC

| Papel | Acesso |
|---|---|
| `ADMIN` | Tudo |
| `ATTENDANT` | Dashboard, livros, empréstimos, devoluções, reservas, leitores, autores (consulta/criação). Sem: usuários, categorias (escrita), relatórios, configurações, auditoria, backup |

## Backups automáticos

`node-cron` roda `VACUUM INTO` em `18:30` e `23:45`. Arquivos em `backend/backups/`. Mantém os 5 mais recentes.

## Quirks do SQLite

- `Prisma contains` é **case-sensitive**. CPF, códigos e números devem ser digitados exatamente.
- Comparação de nomes de autores (reaproveitamento) é case-insensitive feita em memória (sem `mode: 'insensitive'` no SQLite).
