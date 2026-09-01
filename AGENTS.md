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

---

## Arquitetura

- **Backend**: Node.js + Express + TypeScript + Appwrite (Databases + Auth via `node-appwrite`)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Radix UI + React Router
- **Portas**: Backend 3333 (API em `/api`), Frontend 5173 (proxy `/api` → 3333)
- **RBAC**: Duas roles — `ADMIN` e `ATTENDANT`. ADMIN acessa configurações, usuários, relatórios, auditoria, backup. ATTENDANT acessa livros, leitores, empréstimos, devoluções, reservas.
- **Auditoria**: Toda operação registra o usuário responsável na collection `auditLogs` (Appwrite).
- **PDFs**: Termos de empréstimo/devolução gerados dinamicamente com snapshots. Sem armazenamento de arquivos.

## Estrutura Backend

- `backend/src/modules/` — Um arquivo `*.routes.ts` por domínio (auth, book, loan, etc.)
- `backend/src/lib/store.ts` — Data-access layer sobre as coleções Appwrite (`listDocs`, `findDocBy`, `createDoc`, ... + `COLLECTIONS`)
- `backend/src/lib/appwrite.ts` — Cliente Appwrite (`node-appwrite`) + `APPWRITE_*` de ambiente
- `backend/src/validation.ts` — Schemas Zod de validação (usados na borda da API)
- `backend/scripts/setup-appwrite.ts` — Cria banco + coleções + atributos (schema de dados)
- `backend/scripts/seed-appwrite.ts` — Seed estrutural: settings singleton + admin via env
- `backend/scripts/smoke.ts` — Suite E2E (63 casos)

## Estrutura Frontend

- `frontend/src/pages/admin/` — Páginas do painel administrativo
- `frontend/src/pages/public/` — Páginas públicas (catálogo, home)
- `frontend/src/features/` — Módulos de feature (auth, toast)
- `frontend/src/components/` — Componentes compartilhados
- `frontend/src/services/axios.ts` — Cliente API configurado
- `frontend/src/app/router/routes.tsx` — Definição de rotas com guards

---

## Comandos de Desenvolvimento

### Setup

```bash
cd backend
cp .env.example .env   # Preencher APPWRITE_*, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run appwrite:setup # Cria banco + coleções + atributos
npm run appwrite:seed  # Seed estrutural (settings + admin via env)
npm run dev            # Backend em http://localhost:3333/api

cd frontend
npm install
npm run dev            # Frontend em http://localhost:5173
```

### Verificação (ordem recomendada: lint → typecheck → test)

```bash
# Backend
cd backend
npx tsc --noEmit              # Typecheck
npm run smoke                 # E2E (requer backend rodando)

# Frontend
cd frontend
npm run build                 # tsc -b + vite build (valida tipos + gera dist/)
```

### Scripts úteis

```bash
cd backend
npm run appwrite:ping     # Testa conectividade com o Appwrite
npm run appwrite:setup    # Cria banco + coleções + atributos (idempotente)
npm run appwrite:seed     # Seed estrutural (cria admin se .env configurado)
npm run build             # Compila para produção
npm start                 # Inicia produção (requer build antes)
```

---

## Convenções Importantes

- **IDs Appwrite**: Entidades usam `$id` (string) gerado pelo Appwrite. Relacionamentos de livro (autores, categorias, áreas) são desnormalizados como arrays de ids/nomes no documento.
- **Enums**: Appwrite não tem enums nativos. Campos como `format` e `acquisitionType` são strings validadas por Zod em `backend/src/validation.ts`.
- **Snapshots em empréstimos**: Dados do leitor/livro/usuário são salvos no momento do empréstimo para uso nos Termos PDF.
- **Autores**: Formulário aceita nomes separados por vírgulas. Nomes não cadastrados são criados automaticamente (find-or-create, case-insensitive).
- **Exclusão de leitor**: Anonimização LGPD (ADMIN apenas). Empréstimos ativos bloqueiam exclusão.
- **Empréstimo em lote**: Aceita vários livros. Transação única — se qualquer livro falhar, nenhum é criado.
- **Vite proxy**: Frontend proxy automático `/api` → `localhost:3333`. Só definir `VITE_API_URL` se backend em outro host/porta.
- **Dependências**: Appwrite acessado via `node-appwrite`. Setup das coleções/atributos com `npm run appwrite:setup`.

---

## Troubleshooting

- **`EADDRINUSE`**: Porta 3333 ou 5173 em uso. Matar processo ou mudar `PORT` no `.env`.
- **`[fatal] JWT_SECRET ausente`**: Criar `backend/.env` com `JWT_SECRET` definido.
- **Seed não cria admin**: Verificar `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env` antes de `npm run appwrite:seed`.
- **`npm install` falha "Invalid Version"`**: Deletar `package-lock.json` e reinstalar.
- **Falha de conexão/autenticação Appwrite**: Confira `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID` e `APPWRITE_API_KEY` (scopes de databases/users/account). Teste com `npm run appwrite:ping`.
- **`document_already_exists` / `user_already_exists` (registro duplicado)**: Violação de unicidade (ISBN, CPF, etc.) → `409`.

---

## Docs

- [Arquitetura](docs/arquitetura.md) — Stack, fluxo de dados, autenticação, RBAC, auditoria
- [API](docs/api.md) — Endpoints, parâmetros, exemplos
- [Regras de negócio](docs/regras-de-negocio.md) — Limites, prazos, empréstimo em lote
- [Módulos](docs/modulos.md) — Routers backend e páginas/rotas frontend
- [Testes](docs/testes.md) — Smoke E2E, typecheck, validação de UI
