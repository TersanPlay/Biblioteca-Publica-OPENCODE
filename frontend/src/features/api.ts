import { api } from '../services/axios';
import type {
  Author,
  AuditLog,
  Book,
  BookFormValues,
  BookRef,
  Category,
  DashboardData,
  LibrarySettings,
  Loan,
  Paginated,
  Reader,
  ReaderDetail,
  ReportResult,
  ReportType,
  Reservation,
  User,
} from '../types/api';

type Params = Record<string, string | number | undefined>;

function cleanPayload<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== '' && v !== null && v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

function toBookPayload(v: BookFormValues) {
  return cleanPayload({
    title: v.title,
    subtitle: v.subtitle,
    isbn10: v.isbn10,
    isbn13: v.isbn13,
    description: v.description,
    publisher: v.publisher,
    edition: v.edition ? Number(v.edition) : undefined,
    publicationYear: v.publicationYear ? Number(v.publicationYear) : undefined,
    language: v.language,
    pages: v.pages ? Number(v.pages) : undefined,
    coverUrl: v.coverUrl,
    categoryIds: v.categories.filter((c) => c.id != null).map((c) => c.id as number),
    categoryNames: v.categories.filter((c) => c.id == null).map((c) => c.name),
    authorIds: v.authors.filter((a) => a.id != null).map((a) => a.id as number),
    authorNames: v.authors.filter((a) => a.id == null).map((a) => a.name),
  });
}

export const booksApi = {
  list: (params?: Params) => api.get<Paginated<Book>>('/books', { params }).then((r) => r.data),
  get: (id: number) => api.get<Book>(`/books/${id}`).then((r) => r.data),
  create: (v: BookFormValues) => api.post<Book>('/books', toBookPayload(v)).then((r) => r.data),
  update: (id: number, v: BookFormValues) =>
    api.put<Book>(`/books/${id}`, toBookPayload(v)).then((r) => r.data),
  archive: (id: number) => api.delete(`/books/${id}`).then((r) => r.data),
  restore: (id: number) => api.patch(`/books/${id}/restore`).then((r) => r.data),
  cover: (isbn: string) =>
    api
      .get<{
        coverUrl: string;
        title: string | null;
        subtitle: string | null;
        isbn13: string | null;
        description: string | null;
        publisher: string | null;
        publicationYear: number | null;
        pages: number | null;
        authors: string[];
        categories: string[];
      }>('/books/cover', { params: { isbn } })
      .then((r) => r.data),
  exists: (isbn: string, excludeId?: number) =>
    api
      .get<{ book: BookRef | null }>('/books/exists', {
        params: { isbn, ...(excludeId ? { exclude: excludeId } : {}) },
      })
      .then((r) => r.data),
};

export const authorsApi = {
  list: (params?: Params) => api.get<Paginated<Author>>('/authors', { params }).then((r) => r.data),
  all: () => api.get<Paginated<Author>>('/authors?all=1').then((r) => r.data.items),
  get: (id: number) => api.get<Author>(`/authors/${id}`).then((r) => r.data),
  create: (v: Partial<Author>) => api.post<Author>('/authors', cleanPayload(v as Record<string, unknown>)).then((r) => r.data),
  update: (id: number, v: Partial<Author>) => api.put<Author>(`/authors/${id}`, cleanPayload(v as Record<string, unknown>)).then((r) => r.data),
  deactivate: (id: number) => api.patch(`/authors/${id}/deactivate`).then((r) => r.data),
  reactivate: (id: number) => api.patch(`/authors/${id}/reactivate`).then((r) => r.data),
};

export const categoriesApi = {
  list: (params?: Params) => api.get<Paginated<Category>>('/categories', { params }).then((r) => r.data),
  all: (includeInactive = false) =>
    api
      .get<Paginated<Category>>('/categories', { params: includeInactive ? { all: 1 } : {} })
      .then((r) => r.data.items),
  create: (v: { name: string; description?: string }) =>
    api.post<Category>('/categories', v).then((r) => r.data),
  update: (id: number, v: { name: string; description?: string }) =>
    api.put<Category>(`/categories/${id}`, v).then((r) => r.data),
  deactivate: (id: number) => api.patch(`/categories/${id}/deactivate`).then((r) => r.data),
  reactivate: (id: number) => api.patch(`/categories/${id}/reactivate`).then((r) => r.data),
};

export const readersApi = {
  list: (params?: Params) => api.get<Paginated<Reader>>('/readers', { params }).then((r) => r.data),
  get: (id: number) => api.get<ReaderDetail>(`/readers/${id}`).then((r) => r.data),
  create: (v: Record<string, unknown>) =>
    api.post<Reader>('/readers', cleanPayload(v)).then((r) => r.data),
  update: (id: number, v: Record<string, unknown>) =>
    api.put<Reader>(`/readers/${id}`, cleanPayload(v)).then((r) => r.data),
  block: (id: number) =>
    api.patch<Reader>(`/readers/${id}/status`, { status: 'BLOCKED' }).then((r) => r.data),
  unblock: (id: number) =>
    api.patch<Reader>(`/readers/${id}/status`, { status: 'ACTIVE' }).then((r) => r.data),
};

export const loansApi = {
  list: (params?: Params) => api.get<Paginated<Loan>>('/loans', { params }).then((r) => r.data),
  create: (v: { readerId: number; bookId: number; notes?: string; dueDate?: string }) =>
    api.post<Loan>('/loans', v).then((r) => r.data),
  createBatch: (v: { readerId: number; bookIds: number[]; notes?: string; dueDate?: string }) =>
    api.post<{ items: Loan[]; count: number }>('/loans/batch', v).then((r) => r.data),
  return: (id: number) => api.post<Loan>(`/loans/${id}/return`).then((r) => r.data),
  renew: (id: number) => api.post<Loan>(`/loans/${id}/renew`).then((r) => r.data),
  search: (query: string) =>
    api.get<{ items: Loan[] }>('/loans/search', { params: { q: query } }).then((r) => r.data.items),
};

export const reservationsApi = {
  list: (params?: Params) => api.get<Paginated<Reservation>>('/reservations', { params }).then((r) => r.data),
  create: (v: { readerId: number; bookId: number }) =>
    api.post<Reservation>('/reservations', v).then((r) => r.data),
  cancel: (id: number) => api.patch<Reservation>(`/reservations/${id}/cancel`).then((r) => r.data),
  fulfill: (id: number) => api.patch<Reservation>(`/reservations/${id}/fulfill`).then((r) => r.data),
};

export const reportsApi = {
  generate: (type: ReportType, params?: Params) =>
    api.get<ReportResult>('/reports', { params: { type, ...params } }).then((r) => r.data),
};

export const usersApi = {
  list: (params?: Params) => api.get<Paginated<User>>('/users', { params }).then((r) => r.data),
  create: (v: { name: string; email: string; password: string; role: string }) =>
    api.post<User>('/users', v).then((r) => r.data),
  update: (id: number, v: Partial<User> & { password?: string }) =>
    api.put<User>(`/users/${id}`, v).then((r) => r.data),
  deactivate: (id: number) => api.patch(`/users/${id}/deactivate`).then((r) => r.data),
  reactivate: (id: number) => api.patch(`/users/${id}/reactivate`).then((r) => r.data),
};

export const auditApi = {
  list: (params?: Params) => api.get<Paginated<AuditLog>>('/audit', { params }).then((r) => r.data),
};

export const settingsApi = {
  get: () => api.get<LibrarySettings>('/settings').then((r) => r.data),
  update: (v: Partial<LibrarySettings>) =>
    api.put<LibrarySettings>('/settings', v).then((r) => r.data),
};

export const dashboardApi = {
  get: () => api.get<DashboardData>('/dashboard').then((r) => r.data),
};