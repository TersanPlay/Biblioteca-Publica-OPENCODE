import { z } from 'zod';
import { HttpError } from './lib/http-error';

export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join('.') || 'campo'}: ${i.message}`)
      .join('; ');
    throw new HttpError(400, message);
  }
  return result.data;
}

export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += parseInt(digits[i], 10) * (t + 1 - i);
    const rest = ((sum * 10) % 11) % 10;
    if (digits[t] !== String(rest)) return false;
  }
  return true;
}

export function cleanNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function normalizeIsbn(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidIsbn10(value: string): boolean {
  const digits = normalizeIsbn(value);
  if (!/^\d{9}[\dXx]$/.test(digits)) return false;
  const sum = digits
    .slice(0, 9)
    .split('')
    .reduce((acc, c, i) => acc + Number(c) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return (check === 10 ? 'X' : String(check)) === digits[9].toUpperCase();
}

export function isValidIsbn13(value: string): boolean {
  const digits = normalizeIsbn(value);
  if (!/^\d{13}$/.test(digits)) return false;
  const sum = digits
    .slice(0, 12)
    .split('')
    .reduce((acc, c, i) => acc + Number(c) * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[12]);
}

export function cleanInt(value: number | null | undefined): number | null {
  return value === null || value === undefined || Number.isNaN(value) ? null : value;
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const loginSchema = z.object({
  email: z.string().trim().email('e-mail inválido').toLowerCase(),
  password: z.string().min(1, 'senha obrigatória'),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, 'nome obrigatório'),
  email: z.string().trim().email('e-mail inválido').toLowerCase(),
  password: z.string().min(6, 'senha deve ter no mínimo 6 caracteres'),
  role: z.enum(['ADMIN', 'ATTENDANT']).default('ATTENDANT'),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email('e-mail inválido').toLowerCase().optional(),
  role: z.enum(['ADMIN', 'ATTENDANT']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6, 'senha deve ter no mínimo 6 caracteres'),
  currentPassword: z.string().optional(),
});

export const strOpt = z.string().trim().nullish();
export const intOpt = z.coerce.number().int().nullish();
export const emailOpt = z.string().trim().email('e-mail inválido').toLowerCase().nullish();
export const stateOpt = z.string().trim().length(2, 'UF deve ter 2 letras').toUpperCase().nullish();
export const dateStrOpt = strOpt.refine(
  (v) => v == null || v === '' || !Number.isNaN(new Date(v).getTime()),
  'Data inválida',
);

export const isbn10Opt = strOpt.refine(
  (v) => v == null || v === '' || isValidIsbn10(v),
  'Informe um ISBN-10 válido.',
);
export const isbn13Opt = strOpt.refine(
  (v) => v == null || v === '' || isValidIsbn13(v),
  'Informe um ISBN-13 válido.',
);

export const bookSchema = z.object({
  title: z.string().trim().min(2, 'título obrigatório'),
  subtitle: strOpt,
  isbn10: isbn10Opt,
  isbn13: isbn13Opt,
  description: strOpt,
  publisher: strOpt,
  edition: intOpt,
  publicationYear: intOpt,
  language: strOpt,
  pages: intOpt,
  coverUrl: strOpt,
  categoryIds: z.array(z.string()).default([]),
  categoryNames: z.array(z.string().trim().min(2, 'nome de categoria muito curto').max(120)).default([]),
  authorIds: z.array(z.string()).default([]),
  authorNames: z.array(z.string().trim().min(2, 'nome de autor muito curto').max(120)).default([]),
  format: z.enum(['CAPA', 'BROCHURA', 'ESPIRAL']).optional(),
  volume: strOpt,
  cdd: strOpt,
  cutter: strOpt,
  physicalLocation: strOpt,
  availableCopies: intOpt.refine((v) => v == null || v >= 0, 'deve ser maior ou igual a zero'),
  acquisitionType: z.enum([
    'COMPRA', 'DOACAO', 'REPOSICAO', 'PRODUCAO_INTERNA',
    'TROCA', 'EMPRESTIMO_BIBLIOTECAS', 'LICITACAO', 'PERMUTA', 'CONVENIO',
  ]).optional(),
  knowledgeAreaNames: z.array(z.string().trim().min(2, 'nome de area muito curto').max(120)).default([]),
  knowledgeAreaIds: z.array(z.string()).default([]),
});

export const authorSchema = z.object({
  name: z.string().trim().min(2, 'nome obrigatório'),
  isActive: z.boolean().optional(),
});

export const authorStatusSchema = z.object({
  isActive: z.boolean(),
});

export const categoryStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export const readerStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']),
  reason: z.string().max(500).optional(),
  category: z.enum(['ATRASO_REPETIDO', 'COMPORTAMENTO', 'SOLICITACAO', 'OUTRO']).optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'nome obrigatório'),
  description: strOpt,
});

export const readerSchema = z.object({
  name: z.string().trim().min(2, 'nome obrigatório'),
  cpf: z.string().trim().refine(isValidCpf, 'CPF inválido'),
  birthDate: dateStrOpt,
  phone: strOpt,
  email: emailOpt,
  cep: strOpt,
  address: strOpt,
  number: strOpt,
  neighborhood: strOpt,
  city: strOpt,
  state: stateOpt,
});

export const readerUpdateSchema = readerSchema.partial();

export const readerDeleteSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const loanCreateSchema = z.object({
  readerId: z.string().min(1),
  bookId: z.string().min(1),
  dueDate: dateStrOpt,
});

export const loanBatchCreateSchema = z.object({
  readerId: z.string().min(1),
  bookIds: z.array(z.string().min(1)).min(1, 'Selecione ao menos um livro').max(20, 'Máximo de 20 livros por pedido'),
  dueDate: dateStrOpt,
});

export const loanReturnSchema = z.object({
  condition: z.enum(['BOM', 'REGULAR', 'DANIFICADO']).optional(),
  observations: z.string().trim().max(500).optional(),
});

export const reservationCreateSchema = z.object({
  readerId: z.string().min(1),
  bookId: z.string().min(1),
});

export const settingsSchema = z.object({
  loanLimit: z.coerce.number().int().min(1).max(20),
  defaultLoanDays: z.coerce.number().int().min(1).max(90),
  maxRenewals: z.coerce.number().int().min(0).max(5),
  libraryName: z.string().trim().min(2, 'nome da biblioteca obrigatório'),
  libraryAddress: strOpt,
  libraryPhone: strOpt,
  libraryEmail: emailOpt,
  libraryHours: strOpt,
});

export const listQuerySchema = paginationSchema.extend({
  search: strOpt,
  status: strOpt,
});

export const bookQuerySchema = paginationSchema.extend({
  search: strOpt,
  categoryId: strOpt,
  format: z.enum(['CAPA', 'BROCHURA', 'ESPIRAL']).nullish(),
  availability: z.enum(['available', 'unavailable']).nullish(),
  sort: z.enum(['newest', 'oldest', 'title']).default('newest'),
  includeArchived: z.coerce.boolean().default(false),
});

export const readerQuerySchema = paginationSchema.extend({
  search: strOpt,
  status: z.preprocess(
    (v) => (typeof v === 'string' ? v.toUpperCase() : v),
    z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'ALL']),
  ).default('ALL'),
});

export const statusUpperEnum = z.preprocess(
  (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  z.enum(['ACTIVE', 'OVERDUE', 'RETURNED', 'ALL']),
);

export const loanQuerySchema = paginationSchema.extend({
  status: statusUpperEnum.default('ALL'),
  readerId: strOpt,
  start: dateStrOpt,
  end: dateStrOpt,
  search: strOpt,
});

export const reservationQuerySchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'AVAILABLE', 'FULFILLED', 'CANCELLED', 'EXPIRED', 'all']).default('all'),
  readerId: strOpt,
  bookId: strOpt,
  search: strOpt,
});

export const auditQuerySchema = paginationSchema.extend({
  action: strOpt,
  userId: strOpt,
  start: dateStrOpt,
  end: dateStrOpt,
});

export const userQuerySchema = paginationSchema.extend({
  search: strOpt,
  role: z.enum(['ADMIN', 'ATTENDANT']).nullish(),
  status: z.enum(['ACTIVE', 'INACTIVE']).nullish(),
});

export const reportQuerySchema = z.object({
  type: z.enum([
    'acervo',
    'available',
    'loaned',
    'overdue',
    'loans-period',
    'returns-period',
    'active-readers',
    'top-books',
    'categories',
  ]),
  start: dateStrOpt,
  end: dateStrOpt,
  categoryId: strOpt,
  bookId: strOpt,
  readerId: strOpt,
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export function dateOrNull(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}