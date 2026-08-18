export type Role = 'ADMIN' | 'ATTENDANT';
export type Status = 'ACTIVE' | 'INACTIVE';
export type ReaderStatus = 'ACTIVE' | 'BLOCKED' | 'INACTIVE';
export type LoanStatus = 'ACTIVE' | 'OVERDUE' | 'RETURNED';
export type ReservationStatus = 'PENDING' | 'AVAILABLE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: Status;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: Status;
  createdAt: string;
}

export interface Author {
  id: number;
  name: string;
  isActive: boolean;
  _count?: { books: number };
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  status: Status;
  _count?: { books: number };
}

export interface Book {
  id: number;
  isbn10: string | null;
  isbn13: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  publisher: string | null;
  edition: number | null;
  publicationYear: number | null;
  language: string | null;
  pages: number | null;
  coverUrl: string | null;
  isArchived: boolean;
  categories: Category[];
  authors: { author: Author }[];
  isAvailable: boolean;
  hasActiveLoan?: boolean;
  createdAt: string;
  loans?: Loan[];
}

export interface Reader {
  id: number;
  name: string;
  cpf: string;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  cep: string | null;
  address: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  status: ReaderStatus;
  createdAt: string;
  activeLoans?: number;
}

export interface ReaderDetail {
  reader: Reader;
  loans: Loan[];
  activeLoans: Loan[];
  overdueCount: number;
  reservations: Reservation[];
}

export interface Loan {
  id: number;
  number: string | null;
  readerId: number;
  bookId: number;
  userId: number;
  loanDate: string;
  dueDate: string;
  returnedAt: string | null;
  renewals: number;
  notes: string | null;
  status: LoanStatus;
  reader?: Reader;
  book?: Book;
  user?: { id: number; name: string };
}

export interface Reservation {
  id: number;
  readerId: number;
  bookId: number;
  status: ReservationStatus;
  createdAt: string;
  expiresAt: string | null;
  fulfilledAt: string | null;
  reader?: Reader;
  book?: Book;
}

export interface AuditLog {
  id: number;
  userId: number | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: string | null;
  ip: string | null;
  createdAt: string;
  user?: { id: number; name: string; email: string } | null;
}

export interface LibrarySettings {
  loanLimit: number;
  defaultLoanDays: number;
  maxRenewals: number;
  libraryName: string;
  libraryAddress: string | null;
  libraryPhone: string | null;
  libraryEmail: string | null;
  libraryHours: string | null;
}

export interface DashboardData {
  totalBooks: number;
  availableBooks: number;
  loanedBooks: number;
  activeReaders: number;
  activeLoans: number;
  overdueLoans: number;
  recentLoans: Loan[];
  recentReturns: Loan[];
  overdue: Loan[];
  topBooks: { title: string; count: number }[];
}

export interface ReportResult {
  type: string;
  generatedAt: string;
  filters: Record<string, unknown>;
  columns: string[];
  rows: (string | number | null)[][];
}

export type ReportType =
  | 'acervo'
  | 'available'
  | 'loaned'
  | 'overdue'
  | 'loans-period'
  | 'returns-period'
  | 'active-readers'
  | 'top-books'
  | 'categories';

export interface BookRef {
  id: number;
  title: string;
  isbn10: string | null;
  isbn13: string | null;
}

export interface BookFormValues {
  title: string;
  subtitle: string;
  isbn10: string;
  isbn13: string;
  description: string;
  publisher: string;
  edition: string;
  publicationYear: string;
  language: string;
  pages: string;
  coverUrl: string;
  categories: { id: number | null; name: string }[];
  authors: { id: number | null; name: string }[];
}
