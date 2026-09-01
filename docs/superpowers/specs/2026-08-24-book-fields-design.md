# Design: Novos Campos no Cadastro de Livros

## Objetivo

Expandir o formulário de cadastro de livros com 9 novos campos bibliográficos para atender a normas de catalogação profissional.

## Escopo

### Campos novos

| Campo | Tipo | Obrigatório | Observação |
|-------|------|-------------|------------|
| Formato Físico | Enum (CAPA, BROCHURA, ESPIRAL) | não | select simples |
| Volume | String | não | Ex: "Volume 1", "Vol. II", "Tomo I", "Parte 2" |
| Assuntos | Model Subject (many-to-many) | não | autocomplete similar a Categorias |
| Área de Conhecimento | Model KnowledgeArea (many-to-many) | não | autocomplete com busca |
| CDD | String | não | Classificação Decimal Dewey |
| Cutter | String | não | Tabela Cutter |
| Localização Física | String | não | Ex: "Estante A, Prateleira 3" |
| Cópias Disponíveis | Integer | não | Quantidade de exemplares |
| Tipo de Aquisição | Enum (9 valores) | não | select moderno |

### Campos mantidos

- **Status (isArchived)**: permanece como está, sem alterações

## Abordagem

2 migrations sequenciais:
1. Enums + campos scalar no Book
2. Tabelas Subject e KnowledgeArea + relações

## Schema Prisma

### Enums

```prisma
enum BookFormat {
  CAPA
  BROCHURA
  ESPIRAL
}

enum AcquisitionType {
  COMPRA
  DOACAO
  REPOSICAO
  PRODUCAO_INTERNA
  TROCA
  EMPRESTIMO_BIBLIOTECAS
  LICITACAO
  PERMUTA
  CONVENIO
}
```

### Campos scalar no Book

```prisma
model Book {
  // ...campos existentes
  format            BookFormat?
  volume            String?
  cdd               String?
  cutter            String?
  physicalLocation  String?
  availableCopies   Int?
  acquisitionType   AcquisitionType?
  subjects          BookSubject[]
  knowledgeAreas    BookKnowledgeArea[]
}
```

### Modelos novos

```prisma
model Subject {
  id    Int    @id @default(autoincrement())
  name  String @unique
  books BookSubject[]
}

model BookSubject {
  bookId    Int
  subjectId Int
  book      Book    @relation(fields: [bookId], references: [id], onDelete: Cascade)
  subject   Subject @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  @@id([bookId, subjectId])
}

model KnowledgeArea {
  id    Int    @id @default(autoincrement())
  name  String @unique
  books BookKnowledgeArea[]
}

model BookKnowledgeArea {
  bookId          Int
  knowledgeAreaId Int
  book            Book          @relation(fields: [bookId], references: [id], onDelete: Cascade)
  knowledgeArea   KnowledgeArea @relation(fields: [knowledgeAreaId], references: [id], onDelete: Cascade)
  @@id([bookId, knowledgeAreaId])
}
```

### bookInclude

```typescript
export const bookInclude = {
  categories: { include: { category: true } },
  authors: { include: { author: true } },
  subjects: { include: { subject: true } },
  knowledgeAreas: { include: { knowledgeArea: true } },
};
```

## Backend API

### Validação (bookSchema)

```typescript
format: z.enum(['CAPA', 'BROCHURA', 'ESPIRAL']).optional(),
volume: strOpt,
cdd: strOpt,
cutter: strOpt,
physicalLocation: strOpt,
availableCopies: intOpt,
acquisitionType: z.enum([
  'COMPRA','DOACAO','REPOSICAO','PRODUCAO_INTERNA',
  'TROCA','EMPRESTIMO_BIBLIOTECAS','LICITACAO','PERMUTA','CONVENIO'
]).optional(),
subjectNames: z.array(z.string().trim().min(2).max(120)).default([]),
subjectIds: z.array(z.number().int()).default([]),
knowledgeAreaNames: z.array(z.string().trim().min(2).max(120)).default([]),
knowledgeAreaIds: z.array(z.number().int()).default([]),
```

### Funções de resolução

- `resolveSubjectNames(tx, names)` — similar a `resolveCategoryNames()`
- `resolveKnowledgeAreaNames(tx, names)` — similar a `resolveCategoryNames()`

### CREATE/UPDATE

Incluir novos campos no `data` do `prisma.book.create/update`:
- Campos scalar: format, volume, cdd, cutter, physicalLocation, availableCopies, acquisitionType
- Relações: connect subjectIds, create subjectNames, connect knowledgeAreaIds, create knowledgeAreaNames

## Frontend

### Tipos (api.ts)

```typescript
export type BookFormat = 'CAPA' | 'BROCHURA' | 'ESPIRAL';
export type AcquisitionType = 'COMPRA' | 'DOACAO' | 'REPOSICAO' | 'PRODUCAO_INTERNA' | 'TROCA' | 'EMPRESTIMO_BIBLIOTECAS' | 'LICITACAO' | 'PERMUTA' | 'CONVENIO';

export interface Book {
  // ...campos existentes
  format: BookFormat | null;
  volume: string | null;
  cdd: string | null;
  cutter: string | null;
  physicalLocation: string | null;
  availableCopies: number | null;
  acquisitionType: AcquisitionType | null;
  subjects: Subject[];
  knowledgeAreas: KnowledgeArea[];
}

export interface Subject { id: number; name: string; }
export interface KnowledgeArea { id: number; name: string; }
```

### book-form.tsx — Layout reorganizado

**Seção 1: Informações Básicas**
- Título, Subtítulo, ISBN-10, ISBN-13

**Seção 2: Detalhes da Obra**
- Editora, Ano de Publicação, Edição, Volume, Idioma, Páginas, Formato Físico

**Seção 3: Classificação**
- CDD, Cutter, Assuntos (autocomplete), Área de Conhecimento (autocomplete)

**Seção 4: Exemplares**
- Cópias Disponíveis, Localização Física, Tipo de Aquisição

**Seção 5: Descrição e Capa**
- Descrição, URL da Capa

**Seção 6: Autores e Categorias** (já existentes, sem alteração)

### Componentes novos

- `SubjectSelect` — autocomplete similar a `CategoryInput`
- `KnowledgeAreaSelect` — autocomplete similar a `CategoryInput`

### books.tsx (listagem)

- Adicionar coluna "Formato" (Badge)
- Adicionar filtro por Formato

## Restrições

- Anti-mock policy: nenhum dado fictício
- Campos opcionais: nenhum é obrigatório
- Compatibilidade: migrations reversíveis
- Validação: Zod no backend, react-hook-form no frontend
