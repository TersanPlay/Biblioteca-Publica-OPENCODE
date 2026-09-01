# Página Pública de Arquitetura — Design

**Data:** 2026-08-24
**Status:** Aprovado

## Objetivo

Página pública `/arquitetura` descrevendo a arquitetura técnica do projeto, acessível por botão personalizado na landing page.

## Decisões

| Décisão | Escolha |
|---|---|
| Conteúdo | Arquitetura técnica (stack, camadas, fluxo, segurança, operação) |
| Escopo | 1 página única com seções e âncoras |
| Fonte | Estática no frontend, destilada de `docs/arquitetura.md` |
| Abordagem | HTML/CSS nativo (sem react-markdown, sem endpoint novo) |

## Rota

- `GET /arquitetura` — pública, dentro do bloco `PublicLayout`
- Arquivo novo: `frontend/src/pages/public/architecture.tsx`, export `ArchitecturePage`
- Registro em `frontend/src/app/router/routes.tsx`

## Estrutura da página

Header com título "Arquitetura do projeto", badge e descrição curta.

Nav lateral sticky (desktop) / chips horizontais (mobile) com âncoras para:

1. **Visão geral** (`#visao-geral`) — diagrama de 3 camadas em HTML/CSS: Frontend React/Vite → Backend Express API → SQLite, com setas rotuladas "HTTP/JSON + JWT Bearer" e "Prisma ORM". Portas 5173/3333 indicadas.
2. **Stack** (`#stack`) — dois cards: backend (Node.js+TypeScript, Express 4, Prisma 5+SQLite, Zod 3, JWT+bcryptjs, express-rate-limit, node-cron) e frontend (React 18, Vite 5, Tailwind+Radix+Lucide, React Hook Form+Zod, React Router 6, Axios).
3. **Estrutura** (`#estrutura`) — árvore de diretórios essencial em bloco monoespaçado (backend: prisma/, scripts/, src/ com lib/, middleware/, modules/; frontend: app/router/, components/, features/, pages/, services/, types/).
4. **Fluxo de dados** (`#fluxo-de-dados`) — lista numerada com os 8 passos de `docs/arquitetura.md` (chamada → interceptor JWT → rota → Zod → Prisma/transação → auditoria → errorHandler → logout em 401).
5. **Segurança** (`#seguranca`) — JWT 8h via login, comparação anti-enumeração, `requireAuth` valida usuário ACTIVE no banco a cada request, tabela RBAC ADMIN vs ATTENDANT, rate limits (login 10/15min, capa 30/15min).
6. **Operação** (`#operacao`) — backups automáticos VACUUM INTO (18:30/23:45, rotação dos 5 recentes), formato de erro `{ "error": "<mensagem>" }` com tabela resumida de status, chaves de ambiente apenas com nomes (DATABASE_URL, JWT_SECRET, JWT_EXPIRES, ADMIN_EMAIL, ADMIN_PASSWORD, CORS_ORIGIN, VITE_API_URL) sem valores.

Estética: mesmos tokens da landing (canvas warm, shells com spotlight, hairlines, primary #087F8C).

## Botão personalizado na landing

- Local: hero da `HomePage`, abaixo da barra de busca.
- Visual exclusivo (não usa `<Button>`): link-CTA estilo shell da home — `rounded-shell` com borda dupla, hover eleva (-3px), spotlight radial seguindo o mouse (padrão `trackSpotlight`/`Spotlight` já existentes), ícone `Blocks`.
- Texto: "Arquitetura do projeto" + subtítulo "Veja como o sistema foi construído".
- Destino: `/arquitetura`.

## Estados e restrições

- Página estática: sem loading, sem erro, sem chamada de API.
- Anti-mock: conteúdo é documentação descritiva do próprio sistema, não dado de negócio fictício. Chaves `.env` exibidas só como nomes.
- Nenhuma alteração de backend.

## Verificação

1. `npx tsc --noEmit` no frontend sem erros
2. `npm run build` com sucesso
3. Rota `/arquitetura` acessível sem auth; botão na home navega corretamente; âncoras funcionam

## Fora de escopo

- Versão multi-página, renderização de markdown, endpoint de metadados, i18n
