# Testes e validação

## Política anti-dados-mock (regra do projeto)

- É proibido dados mock/fictícios/placeholders no código de produção (listagens, gráficos, credenciais demo, seeds com dados institucionais falsos, fallbacks inventados).
- Fontes de dados em tempo de execução: apenas API/banco. Estados vazios reais ("Nenhum livro cadastrado") são obrigatórios.
- Primeiro acesso do administrador via `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- **Exceção**: fixtures de testes automatizados podem criar dados fictícios, identificados como TEST e removidos ao final (best-effort).

## Suite E2E via API — `backend/scripts/smoke.ts`

Executa contra a API real (requer o backend rodando em `http://localhost:3333/api`):

```bash
cd backend
npm run smoke        # npx tsx scripts/smoke.ts
```

Cobre **63 casos**, incluindo:

- Login, RBAC (ADMIN × ATTENDANT), token inválido/expirado, rate limit
- CRUD de livros, autores, assuntos, leitores, usuários
- ISBN (validação, duplicado → 409, normalize)
- Campos expandidos do livro (format, volume, cdd, cutter, physicalLocation, availableCopies, acquisitionType)
- Áreas de conhecimento (cadastro automático, relação N:N com livros)
- Empréstimo individual e em lote (limites, livro emprestado/reservado/arquivado, duplicados, prazo futuro, leitor bloqueado/atrasado)
- Renovação (limite, atrasado, bloqueado, reserva pendente)
- Devolução com condição/observações e ativação de reserva (`AVAILABLE`)
- Reservas (criação, cancelamento, atendimento, expiração)
- Relatórios (todos os tipos) e exportação CSV
- Configurações e auditoria
- Exclusão de leitor com anonimização LGPD

As fixtures são criadas com nomes/emails marcados como `TEST` e removidas no `finally` de cada caso — ao final, o banco volta ao estado anterior.

## Typecheck

```bash
cd backend && npx tsc --noEmit     # tipos do backend
cd frontend && npm run build       # tsc -b + vite build (valida tipos e build)
```

## Validação de UI (Chrome DevTools Protocol)

Fluxos de interface são validados com scripts temporários usando Edge headless + CDP (client `ws`), contra fixtures TEST:

- Técnica: setar inputs via native setter + disparar `input`; cliques em elementos com handlers `onMouseDown` (ex.: sugestões de autor) exigem `dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`.
- Scripts e perfis ficam em diretório temporário (ex.: `%TEMP%\opencode`) e são **removidos ao final**.
- Exemplos de fluxos já validados: empréstimo multi-livro (9 etapas), campo de autores com vírgula e autocomplete, login e navegação.

## Checklist de conclusão de tarefa (AGENTS.md)

1. Os dados exibidos vêm de fonte real (API/banco)?
2. Estados vazios e de erro estão implementados?
3. Não há fallback fictício em caso de ausência de dados?
4. Não há credenciais demo expostas na UI ou no seed?
