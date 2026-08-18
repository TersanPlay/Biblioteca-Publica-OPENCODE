# Sistema de Livraria Pública

Sistema web para gestão de biblioteca pública: acervo, leitores, exemplares, empréstimos, devoluções, usuários, relatórios e catálogo público.

## Stack

- **Backend**: Node.js + Express + TypeScript + Prisma ORM + SQLite (preparado para PostgreSQL) + JWT + bcryptjs
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Radix UI + Lucide React + React Router + Axios + React Hook Form + Zod
- **UI/UX**: metodologia UI Architect ASJ (canvas `#F2F2F0`, primary `#087F8C`, superfícies creme, hairline, motion refinado)

## Estrutura

```
backend/   API REST (porta 3333, URL base /api)
frontend/  SPA (Vite dev na porta 5173, proxy /api → 3333)
```

## Setup

### Backend

```bash
cd backend
npm install
npm run db:setup   # cria o SQLite (dev.db), aplica o schema e roda o bootstrap estrutural
npm run dev        # http://localhost:3333/api
```

> O projeto não usa dados demonstrativos. O seed cria apenas a linha de configuração
> (regras de empréstimo com campos institucionais vazios). O primeiro acesso de
> administrador é criado a partir de variáveis de ambiente, que devem ser definidas
> no `backend/.env` antes de rodar npm run db:seed:

```
ADMIN_NAME=Administrador
ADMIN_EMAIL=voce@seu-dominio.com
ADMIN_PASSWORD=sua-senha-forte
```

> Sem essas variáveis, o seed não cria usuário algum — informe sua própria credencial
> e configure os dados institucionais (nome, contato, horário) na tela Configurações.

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### Primeiro acesso

O sistema não entrega credenciais de demonstração. Crie seu administrador definindo
`ADMIN_EMAIL`/`ADMIN_PASSWORD` (e opcionalmente `ADMIN_NAME`) no `backend/.env` e
executando `npm run db:seed`. Perfis adicionais (atendente) são criados pela tela
Usuários, após o primeiro login.

## Documentação completa

- [Arquitetura](docs/arquitetura.md) — stack, fluxo de dados, autenticação, RBAC, auditoria, erros
- [Referência da API](docs/api.md) — todos os endpoints, parâmetros, exemplos e erros
- [Regras de negócio](docs/regras-de-negocio.md) — limites, prazos, empréstimo em lote, autores, reservas
- [Módulos](docs/modulos.md) — routers do backend e páginas/rotas do frontend
- [Testes e validação](docs/testes.md) — smoke E2E, typecheck, validação de UI, política anti-mock

## Fluxo MVP validado

Cadastrar livro → cadastrar exemplar → cadastrar leitor → realizar empréstimo → acompanhar prazo → registrar devolução → disponibilizar novamente o exemplar.

## Regras de negócio

- Limite inicial de 4 exemplares por leitor (configurável em Configurações)
- Prazo padrão de 15 dias (configurável)
- Leitor bloqueado ou inativo não realiza nem renova empréstimo
- Exemplar indisponível não é emprestado
- Empréstimo vencido vira ATRASADO automaticamente
- Devolução libera o exemplar e pode ativar reserva aguardando
- Novo empréstimo aceita vários livros de uma vez, limitado ao que sobra do
  limite do leitor (ativos + selecionados ≤ limite configurado); os empréstimos
  são criados em transação única — se qualquer livro falhar (já emprestado,
  reservado, arquivado), nenhum é criado
- Autores: o formulário do livro aceita nomes separados por vírgulas; nomes não
  cadastrados são criados automaticamente ao salvar, reaproveitando o autor
  existente quando o nome bate ignorando maiúsculas
- Toda operação registra o usuário responsável (auditoria)

## Testes

Detalhes em [docs/testes.md](docs/testes.md). Resumo:

- `backend/scripts/smoke.ts` (suite E2E via API, com fixtures TEST removidas ao
  final): `cd backend && npx tsx scripts/smoke.ts`
- `npm run build`/`npx tsc --noEmit` em `backend/` e `frontend/` validam os tipos
- Fluxos de UI são validados via Chrome DevTools Protocol (scripts temporários
  com Edge headless) contra fixtures TEST, removidos ao final

## Notas

- Buscas textuais no SQLite (Prisma `contains`) são case-sensitive; CPFs, códigos e números devem ser digitados conforme cadastrados.
- Senhas com bcryptjs (API compatível com bcrypt, sem dependência nativa no Windows).
- A comparação de nomes de autores para reaproveitamento ignora maiúsculas (feita em memória, no backend).
- **Discrepâncias conhecidas frontend × backend** (rotas de toggle de status e ações de reserva): ver [docs/api.md](docs/api.md).