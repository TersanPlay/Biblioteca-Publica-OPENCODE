export type Role = 'ADMIN' | 'ATTENDANT';
export type Status = 'ACTIVE' | 'INACTIVE';
export type ReaderStatus = 'ACTIVE' | 'BLOCKED' | 'INACTIVE';
export type LoanStatus = 'ACTIVE' | 'OVERDUE' | 'RETURNED';
export type ReservationStatus = 'PENDING' | 'AVAILABLE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
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
  $id: string;
  name: string;
  email: string;
  role: Role;
  status: Status;
  $createdAt: string;
  $updatedAt: string;
}

export interface Author {
  $id: string;
  name: string;
  isActive: boolean;
  _count?: { books: number };
}

export interface Subject {
  $id: string;
  name: string;
  description: string | null;
  status: Status;
  _count?: { books: number };
}

export type BookFormat = 'CAPA' | 'BROCHURA' | 'ESPIRAL';

export type AcquisitionType =
  | 'COMPRA'
  | 'DOACAO'
  | 'REPOSICAO'
  | 'PRODUCAO_INTERNA'
  | 'TROCA'
  | 'EMPRESTIMO_BIBLIOTECAS'
  | 'LICITACAO'
  | 'PERMUTA'
  | 'CONVENIO';

export interface KnowledgeArea {
  $id: string;
  name: string;
}

export interface Book {
  $id: string;
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
  format: BookFormat | null;
  volume: string | null;
  cdd: string | null;
  cutter: string | null;
  physicalLocation: string | null;
  availableCopies: number | null;
  acquisitionType: AcquisitionType | null;
  isArchived: boolean;
  authorIds: string[];
  authorNames: string[];
  subjectIds: string[];
  subjectNames: string[];
  knowledgeAreaIds: string[];
  knowledgeAreaNames: string[];
  isAvailable: boolean;
  hasActiveLoan?: boolean;
  $createdAt: string;
  $updatedAt: string;
  loans?: Loan[];
}

export interface Reader {
  $id: string;
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
  deletedAt: string | null;
  activeLoans?: number;
  $createdAt: string;
  $updatedAt: string;
}

export interface BlockedReader extends Reader {
  blockReason: string | null;
  blockCategory: string | null;
  blockedAt: string | null;
  blockedByName: string | null;
}

export interface BookTitleRef {
  $id: string;
  title: string | null;
}

export interface ReaderNameRef {
  id: string;
  name: string | null;
  cpf: string | null;
}

export interface Loan {
  $id: string;
  number: string | null;
  readerId: string;
  bookId: string;
  userId: string;
  loanDate: string;
  dueDate: string;
  returnedAt: string | null;
  renewals: number;
  notes: string | null;
  status: LoanStatus;
  readerNameSnapshot?: string | null;
  bookTitleSnapshot?: string | null;
  bookAuthorSnapshot?: string | null;
  bookIsbnSnapshot?: string | null;
  bookNumberSnapshot?: string | null;
  createdByNameSnapshot?: string | null;
  returnCondition?: string | null;
  returnObservations?: string | null;
  receivedByNameSnapshot?: string | null;
  $createdAt: string;
  $updatedAt: string;
}

export interface Reservation {
  $id: string;
  readerId: string;
  bookId: string;
  status: ReservationStatus;
  expiresAt: string | null;
  fulfilledAt: string | null;
  $createdAt: string;
  $updatedAt: string;
  reader?: ReaderNameRef | null;
  book?: BookTitleRef | null;
  bookTitle?: string | null;
}

export interface AuditLog {
  $id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: string | null;
  ip: string | null;
  $createdAt: string;
}

export interface Backup {
  filename: string;
  size: number;
  createdAt: string;
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

export interface ReaderDetail {
  reader: Reader;
  loans: Loan[];
  activeLoans: Loan[];
  overdueCount: number;
  reservations: Reservation[];
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
  | 'subjects';

export interface BookRef {
  id: string;
  title: string;
  isbn10: string | null;
  isbn13: string | null;
}

export interface DuplicateConflict {
  success: false;
  code: 'BOOK_ALREADY_EXISTS';
  message: string;
  duplicate: BookRef;
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
  format: string;
  volume: string;
  cdd: string;
  cutter: string;
  physicalLocation: string;
  availableCopies: string;
  acquisitionType: string;
  subjects: { id: string | null; name: string }[];
  authors: { id: string | null; name: string }[];
  knowledgeAreas: { id: string | null; name: string }[];
}
