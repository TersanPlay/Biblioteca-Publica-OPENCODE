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