# Sistema de Biblioteca Pública

Sistema web para gestão de biblioteca pública: acervo, leitores, exemplares, empréstimos, devoluções, usuários, relatórios e catálogo público.

## Stack

- **Backend**: Node.js + Express + TypeScript + Appwrite (Databases + Auth via `node-appwrite`) + JWT + pdfkit (geração de termos PDF) + node-cron (backups automáticos)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Radix UI + Lucide React + React Router + Axios + React Hook Form + Zod
- **UI/UX**: metodologia UI Architect ASJ (canvas `#F2F2F0`, primary `#087F8C`, superfícies creme, hairline, motion refinado)

## Estrutura

```
backend/   API REST (porta 3333, URL base /api)
frontend/  SPA (Vite dev na porta 5173, proxy /api → 3333)
```

---

## Pré-requisitos

| Requisito | Versão mínima | Como verificar |
|-----------|---------------|----------------|
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |

> O projeto foi testado com Node.js 24.x e npm 11.x. Versões mais antigas (18+) devem funcionar.

---

## Instalação passo a passo

### 1. Clonar o repositório

```bash
git clone https://github.com/TersanPlay/Biblioteca-Publica-OPENCODE.git
cd Biblioteca-Publica-OPENCODE
```

### 2. Configurar o Backend

#### 2.1 Instalar dependências

```bash
cd backend
npm install
```

#### 2.2 Configurar o Appwrite (projeto cloud)

O sistema usa o **Appwrite Cloud** como banco de dados e autenticação. Crie um projeto no
console do Appwrite e gere uma **API Key** (com os scopes de *databases*, *users* e *account*).

#### 2.3 Criar o arquivo `.env`

Crie o arquivo `backend/.env` com o seguinte conteúdo:

```env
APPWRITE_ENDPOINT="https://fra.cloud.appwrite.io/v1"
APPWRITE_PROJECT_ID=id-do-seu-projeto
APPWRITE_DATABASE_ID=biblioteca
APPWRITE_API_KEY=cole-sua-api-key-do-console
JWT_SECRET=cole-um-segredo-forte-aqui-minimo-32-caracteres
ADMIN_EMAIL=seu@email.com
ADMIN_PASSWORD=sua-senha-forte
```

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `APPWRITE_ENDPOINT` | Sim | URL da API do Appwrite (padrão é o endpoint do Cloud) |
| `APPWRITE_PROJECT_ID` | Sim | ID do projeto criado no console Appwrite |
| `APPWRITE_DATABASE_ID` | Sim | ID do banco de dados (padrão: `biblioteca`) |
| `APPWRITE_API_KEY` | Sim | Chave de API com scopes de databases/users/account |
| `JWT_SECRET` | Sim | Chave secreta para assinar os tokens de sessão da aplicação (mínimo 32 caracteres) |
| `ADMIN_EMAIL` | Sim | E-mail do primeiro administrador. Será usado para fazer login |
| `ADMIN_PASSWORD` | Sim | Senha do primeiro administrador. Mínimo 6 caracteres |
| `ADMIN_NAME` | Não | Nome exibido do administrador. Padrão: `Administrador` |
| `JWT_EXPIRES` | Não | Tempo de expiração do token. Padrão: `8h` |
| `CORS_ORIGIN` | Não | Origens permitidas (separadas por vírgula). Padrão: `http://localhost:5173` |

> **Gerar JWT_SECRET aleatório** (opção rápida):
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

#### 2.4 Preparar o banco de dados (Appwrite)

```bash
npm run appwrite:setup   # cria banco + coleções + atributos (requer APPWRITE_API_KEY)
npm run appwrite:seed    # cria a configuração inicial e o admin via ADMIN_EMAIL/ADMIN_PASSWORD
```

> `appwrite:setup` e `appwrite:seed` são **idempotentes** — podem ser repetidos sem duplicar dados.

#### 2.5 Iniciar o servidor

```bash
npm run dev
```

O backend estará disponível em: **http://localhost:3333/api**

Para verificar se está rodando:
```bash
curl http://localhost:3333/api/health
# Resposta: {"ok":true,"service":"livraria-api"}
```

### 3. Configurar o Frontend

Em um novo terminal:

```bash
cd frontend
npm install
npm run dev
```

O frontend estará disponível em: **http://localhost:5173**

> O Vite configura automaticamente um proxy de `/api` para `localhost:3333`, então o frontend
> se comunica com o backend sem configuração adicional.

### 4. Primeiro acesso

1. Acesse **http://localhost:5173**
2. Clique em "Entrar" ou acesse **http://localhost:5173/login**
3. Use as credenciais definidas no `.env`:
   - **E-mail**: o valor de `ADMIN_EMAIL`
   - **Senha**: o valor de `ADMIN_PASSWORD`
4. Após login, configure os dados da biblioteca em **Configurações** (nome, endereço, telefone, horário)

> **Importante**: O sistema não possui credenciais de demonstração. O primeiro usuário é
> criado exclusivamente pelas variáveis de ambiente. Usuários adicionais (atendentes) são
> criados pela tela **Usuários** após o primeiro login.

---

## Comandos úteis

### Backend

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia o servidor com hot-reload (tsx watch) |
| `npm run build` | Compila TypeScript para JavaScript (produção) |
| `npm start` | Inicia o servidor em produção (requer `npm run build` antes) |
| `npm run appwrite:setup` | Cria banco + coleções + atributos no Appwrite (idempotente) |
| `npm run appwrite:seed` | Cria configuração inicial + admin (via `ADMIN_EMAIL`/`ADMIN_PASSWORD`) |
| `npm run appwrite:ping` | Testa a conectividade com o Appwrite |
| `npm run smoke` | Executa a suíte de testes E2E (63 casos) |
| `npx tsc --noEmit` | Verifica tipos sem gerar output |

### Frontend

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia o servidor de desenvolvimento Vite |
| `npm run build` | Compila para produção (verifica tipos + gera `dist/`) |
| `npm run preview` | Visualiza a build de produção localmente |

> **Nota sobre PDFs**: A geração de Termos de Empréstimo/Devolução é feita no backend via `pdfkit`. Os PDFs são gerados dinamicamente e servidos como blobs autenticados — não há armazenamento de arquivos PDF no servidor.

---

## Variáveis de ambiente do Frontend

Crie `frontend/.env` (opcional):

```env
VITE_API_URL=http://localhost:3333/api
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `VITE_API_URL` | `/api` (proxy do Vite) | URL da API. Só precisa definir se o backend estiver em outro host/porta |

---

## Troubleshooting (Problemas comuns)

### `EADDRINUSE: porta já está em uso`

Outro processo está usando a porta 3333 ou 5173.

```bash
# Windows — encontrar e matar o processo na porta
netstat -ano | findstr :3333
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3333
kill -9 <PID>
```

### `[fatal] JWT_SECRET ausente`

O arquivo `backend/.env` não existe ou está vazio. Crie-o seguindo a seção 2.2.

### Seed não cria usuário administrador

Verifique se `ADMIN_EMAIL` e `ADMIN_PASSWORD` estão definidos no `backend/.env` antes de rodar `npm run appwrite:seed`. Sem essas variáveis, o seed cria apenas a configuração inicial.

### `npm install` falha com "Invalid Version"

Possível lockfile corrompido (gerado por outra package manager). Solução:

```bash
cd frontend
del package-lock.json   # Windows
rm package-lock.json    # Linux/Mac
npm install
```

### Erro `document_already_exists` / `user_already_exists` (registro duplicado)

Violação de unicidade no Appwrite. Ex.: tentar cadastrar um livro com ISBN já existente ou um leitor com CPF já cadastrado → `409`.

### Erro ao conectar/autenticar no Appwrite

Confira `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID` e `APPWRITE_API_KEY` no `backend/.env`. A API key precisa dos scopes de *databases*, *users* e *account*. Teste com `npm run appwrite:ping`.

---

## Documentação completa

- [Arquitetura](docs/arquitetura.md) — stack, fluxo de dados, autenticação, RBAC, auditoria, erros
- [Referência da API](docs/api.md) — todos os endpoints, parâmetros, exemplos e erros
- [Regras de negócio](docs/regras-de-negocio.md) — limites, prazos, empréstimo em lote, autores, reservas, exclusão de leitores, backup
- [Módulos](docs/modulos.md) — routers do backend e páginas/rotas do frontend
- [Testes e validação](docs/testes.md) — smoke E2E, typecheck, validação de UI, política anti-mock

## Fluxo MVP validado

Cadastrar livro → cadastrar leitor → realizar empréstimo → gerar Termo de Empréstimo (PDF) → acompanhar prazo → registrar devolução com condição → gerar Termo de Devolução (PDF) → disponibilizar novamente o livro.

## Regras de negócio

- Limite inicial de 4 empréstimos ativos por leitor (configurável em Configurações)
- Prazo padrão de 15 dias (configurável)
- Leitor bloqueado ou inativo não realiza nem renova empréstimo
- Livro indisponível não é emprestado
- Empréstimo vencido vira ATRASADO automaticamente
- Snapshots de dados (leitor, livro, usuário) salvos no momento do empréstimo para uso nos Termos PDF
- Devolução libera o livro e pode ativar reserva aguardando
- Novo empréstimo aceita vários livros de uma vez, limitado ao que sobra do
  limite do leitor (ativos + selecionados ≤ limite configurado); os empréstimos
  são criados em transação única — se qualquer livro falhar (já emprestado,
  reservado, arquivado), nenhum é criado
- Autores: o formulário aceita nomes separados por vírgulas; nomes não
  cadastrados são criados automaticamente ao salvar, reaproveitando o autor
  existente quando o nome bate ignorando maiúsculas
- Áreas de conhecimento: mesmo padrão dos autores (find-or-create, relação N:N)
- Livros possuem campos expandidos: formato (CAPA/BROCHURA/ESPIRAL), volume, CDD, cutter, localização física, cópias disponíveis, tipo de aquisição
- Exclusão de leitores com anonimização LGPD (ADMIN apenas): dados pessoais substituídos, empréstimos ativos bloqueiam exclusão
- Termos de empréstimo/devolução: PDFs gerados dinamicamente com snapshots, acessíveis pelo histórico do leitor
- Devolução com registro de condição do material (BOM/REGULAR/DANIFICADO) e observações
- Backups: exporta as coleções do Appwrite para arquivos JSON (automático 18:30/23:45), com download e exclusão. Restauração manual indisponível (o Appwrite é a fonte de dados)
- Termos de Empréstimo/Devolução: geração de PDFs profissionais com snapshots dos dados, acessíveis pela página do leitor
- Devolução com condição do material (BOM/REGULAR/DANIFICADO) e observações/ocorrências
- Toda operação registra o usuário responsável (auditoria)

## Testes

Detalhes em [docs/testes.md](docs/testes.md). Resumo:

```bash
# Backend — testes E2E (requer backend rodando)
cd backend && npm run smoke

# Backend — verificação de tipos
cd backend && npx tsc --noEmit

# Frontend — verificação de tipos + build
cd frontend && npm run build
```

## Notas

- IDs das entidades são strings geradas pelo Appwrite (`$id`); relacionamentos (autores, categorias, áreas de conhecimento) são armazenados como arrays de ids/nomes nos documentos.
- Em empréstimos, dados do leitor/livro/usuário são salvos como snapshots no momento do registro para os Termos PDF.
- A autenticação das credenciais fica no Appwrite Auth; o backend mantém apenas os metadados de `role`/`status` na collection `users` e emite um JWT de sessão própria.
- `format` e `acquisitionType` são strings validadas por Zod na borda da API (sem enums nativos no Appwrite).
