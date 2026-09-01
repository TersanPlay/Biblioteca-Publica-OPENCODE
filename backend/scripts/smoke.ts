import 'dotenv/config';
import { app } from '../src/app';
import type { Server } from 'http';
import { listDocs, deleteDoc, COLLECTIONS, type CollectionId } from '../src/lib/store';

const SMOKE_BOOK_PREFIXES = [
  'Livro de Teste Smoke',
  'Livro Sem Auth OK',
  'Livro ISBN Teste',
  'Livro AutorName Smoke',
  'Livro Assunto Smoke',
];
const SMOKE_AUTHORS = [
  'Autor Smoke Test',
  'Autor Novo Smoke A',
  'Autor Novo Smoke B',
  'Autor Novo Smoke C',
  'Autor Novo Smoke D',
];
const SMOKE_SUBJECTS = [
  'Assunto Smoke Test',
  'Assunto Smoke Test B',
  'Assunto Smoke Test C',
  'Assunto Smoke Test D',
];
const SMOKE_READER_EMAIL = 'smoke@test.local';

let passed = 0;
let failed = 0;

function ok(label: string) {
  passed++;
  console.log(`  PASS  ${label}`);
}

function fail(label: string, detail?: unknown) {
  failed++;
  console.log(`  FAIL  ${label}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 300)}` : ''}`);
}

function randomValidCpf(): string {
  const base = String(Math.floor(100000000 + Math.random() * 899999999));
  const digits = base.split('').map(Number);
  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += digits[i] * (t + 1 - i);
    const rest = ((sum * 10) % 11) % 10;
    if (digits.length <= t) digits.push(rest);
    else digits[t] = rest;
  }
  return digits.join('');
}

function genIsbn10(seed9: string): string {
  const sum = seed9.split('').reduce((acc, c, i) => acc + Number(c) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return seed9 + (check === 10 ? 'X' : String(check));
}

function genIsbn13(seed12: string): string {
  const sum = seed12.split('').reduce((acc, c, i) => acc + Number(c) * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return seed12 + check;
}

function fmtIsbn13(isbn13: string): string {
  return `${isbn13.slice(0, 3)}-${isbn13.slice(3, 7)}-${isbn13.slice(7, 12)}-${isbn13.slice(12)}`;
}

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) {
  console.error('FATAL: ADMIN_EMAIL and ADMIN_PASSWORD must be set in backend/.env');
  process.exit(1);
}

const attendantEmail = `smoke.attendant.${Date.now()}@test.local`;
const attendantPassword = 'SmokePass123';
const attendantName = 'Atendente Smoke Test';

const createdBookIds: string[] = [];
const createdReaderIds: string[] = [];
const createdLoanIds: string[] = [];
let attendantUserId: string | undefined;
let adminToken: string | undefined;

async function main() {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${(server.address() as { port: number }).port}`;

  const j = async (path: string, init?: RequestInit) => {
    const res = await fetch(base + path, init);
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* no body */
    }
    return { status: res.status, body };
  };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

  try {
    let r = await j('/api/health');
    r.status === 200 ? ok('health') : fail('health', r);

    r = await j('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    if (r.status === 200 && r.body.token) ok('login admin');
    else fail('login admin', r);
    adminToken = r.body?.token;

    r = await j('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'senha-errada' }),
    });
    r.status === 401 ? ok('login inválido rejeitado') : fail('login inválido rejeitado', r);

    r = await j('/api/users', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ name: attendantName, email: attendantEmail, password: attendantPassword, role: 'ATTENDANT' }),
    });
    if (r.status === 201 && r.body?.$id) {
      ok('criar atendente fixture via API');
      attendantUserId = r.body.$id;
    } else fail('criar atendente fixture', r);

    r = await j('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: attendantEmail, password: attendantPassword }),
    });
    const attendantToken = r.body?.token;
    r.status === 200 && attendantToken ? ok('login atendente') : fail('login atendente', r);

    r = await j('/api/subjects', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ name: 'Assunto Smoke Test', description: 'Fixture de teste' }),
    });
    const subjectId = r.body?.$id;
    subjectId ? ok('criar assunto fixture') : fail('criar assunto fixture', r);

    r = await j('/api/authors', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ name: 'Autor Smoke Test' }),
    });
    const authorId = r.body?.$id;
    authorId ? ok('criar autor fixture') : fail('criar autor fixture', r);

    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({
        title: 'Livro de Teste Smoke',
        isbn: '978555' + String(Date.now()).slice(-7),
        publicationYear: 2024,
        pages: 100,
        language: 'Português',
        subjectIds: [subjectId],
        authorIds: [authorId],
      }),
    });
    const bookId = r.body?.$id;
    if (bookId) { ok('criar livro'); createdBookIds.push(bookId); } else fail('criar livro', r);

    r = await j('/api/books/' + bookId);
    r.status === 200 && r.body?.hasActiveLoan === false
      ? ok('badge: sem empréstimo ativo no início')
      : fail('badge sem empréstimo', r);

    r = await j('/api/books?pageSize=5');
    if (r.status === 200 && Array.isArray(r.body?.items) && r.body.items.length > 0) ok('catálogo público');
    else fail('catálogo público', r);

    r = await j('/api/books?availability=available&pageSize=5');
    const hasOnlyAvailable = r.body?.items?.every((b: any) => b.isAvailable === true);
    r.status === 200 && hasOnlyAvailable ? ok('filtro disponibilidade') : fail('filtro disponibilidade', r);

    const cpf = randomValidCpf();
    r = await j('/api/readers', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({
        name: 'Leitor Smoke Test',
        cpf,
        phone: '(11) 90000-0000',
        email: 'smoke@test.local',
      }),
    });
    const readerId = r.body?.$id;
    if (readerId) { ok('criar leitor'); createdReaderIds.push(readerId); } else fail('criar leitor', r);

    r = await j('/api/readers', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ name: 'CPF Inválido', cpf: '11111111111' }),
    });
    r.status === 400 ? ok('CPF inválido rejeitado') : fail('CPF inválido rejeitado', r);

    r = await j('/api/loans', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ readerId, bookId }),
    });
    if (r.status === 201 && r.body?.number?.startsWith('EMP-')) ok('criar empréstimo (' + r.body.number + ')');
    else fail('criar empréstimo', r);
    const loanId = r.body?.$id;
    if (loanId) createdLoanIds.push(loanId);

    r = await j('/api/books/' + bookId);
    r.status === 200 && r.body?.hasActiveLoan === true
      ? ok('badge: hasActiveLoan true com empréstimo ativo')
      : fail('badge com empréstimo ativo', r);

    r = await j('/api/loans/' + loanId + '/renew', { method: 'POST', headers: auth(adminToken!) });
    r.status === 200 ? ok('renovar empréstimo') : fail('renovar empréstimo', r);

    r = await j('/api/loans?status=active', { headers: auth(adminToken!) });
    r.status === 200 && r.body?.items?.some((l: any) => l.$id === loanId) ? ok('listar empréstimos ativos') : fail('listar ativos', r);

    r = await j('/api/loans/' + loanId + '/return', { method: 'POST', headers: auth(adminToken!) });
    r.status === 200 && r.body?.status === 'RETURNED' ? ok('devolver empréstimo') : fail('devolver', r);

    r = await j('/api/books/' + bookId);
    r.status === 200 && r.body?.hasActiveLoan === false
      ? ok('badge: hasActiveLoan false após devolução')
      : fail('badge após devolução', r);

    r = await j('/api/books?availability=unavailable&pageSize=50', { headers: auth(adminToken!) });
    r.status === 200 && !r.body?.items?.some((b: any) => b.$id === bookId)
      ? ok('filtro indisponíveis exclui livro devolvido')
      : fail('filtro indisponíveis', r);

    r = await j('/api/loans', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ readerId, bookId }),
    });
    if (r.status === 201) {
      const l2 = r.body.$id;
      await j('/api/loans/' + l2 + '/return', { method: 'POST', headers: auth(adminToken!) });
      ok('ciclo completo livro→leitor→empréstimo→devolução');
    } else fail('ciclo completo', r);

    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({
        title: 'Livro de Teste Smoke 2',
        isbn: '978555' + String(Date.now() + 1).slice(-7),
        publicationYear: 2024,
        pages: 90,
        language: 'Português',
        subjectIds: [subjectId],
        authorIds: [authorId],
      }),
    });
    const bookId2 = r.body?.$id;
    if (bookId2) { ok('criar livro 2 fixture'); createdBookIds.push(bookId2); } else fail('criar livro 2 fixture', r);

    r = await j('/api/loans/batch', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ readerId, bookIds: [bookId, bookId2] }),
    });
    if (r.status === 201 && r.body?.count === 2) {
      ok('batch cria múltiplos empréstimos em transação única');
      const batchIds = (r.body.items as any[]).map((l: any) => l.$id);
      for (const id of batchIds) createdLoanIds.push(id);
      const batchReturn = await j('/api/loans?status=active', { headers: auth(adminToken!) });
      const allActive = batchIds.every((id: string) =>
        batchReturn.body?.items?.some((l: any) => l.$id === id && l.status === 'ACTIVE'),
      );
      allActive ? ok('batch lista empréstimos criados como ativos') : fail('batch ativos', batchReturn);
      for (const id of batchIds) {
        await j('/api/loans/' + id + '/return', { method: 'POST', headers: auth(adminToken!) });
      }
    } else fail('batch cria múltiplos empréstimos', r);

    r = await j('/api/loans/batch', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ readerId, bookIds: [bookId, bookId] }),
    });
    r.status === 400 ? ok('batch rejeita livro duplicado') : fail('batch duplicado', r);

    r = await j('/api/loans', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ readerId, bookId }),
    });
    if (r.status !== 201) fail('preparar conflito para batch', r);

    r = await j('/api/loans/batch', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ readerId, bookIds: [bookId, bookId2] }),
    });
    r.status === 400 ? ok('batch aborta tudo quando um livro falha') : fail('batch aborta tudo', r);

    r = await j('/api/loans?readerId=' + readerId + '&status=active', { headers: auth(adminToken!) });
    r.status === 200 && r.body?.items?.length === 1
      ? ok('falha parcial não cria nenhum empréstimo')
      : fail('falha parcial criou empréstimos', r);

    await j('/api/loans?status=active', { headers: auth(adminToken!) }).then(async (act) => {
      const mine = (act.body?.items as any[]).filter((l: any) => l.readerId === readerId);
      for (const l of mine) {
        await j('/api/loans/' + l.$id + '/return', { method: 'POST', headers: auth(adminToken!) });
      }
    });

    r = await j('/api/loans/batch', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ readerId, bookIds: ['99991-bogus', '99992-bogus', '99993-bogus', '99994-bogus', '99995-bogus'] }),
    });
    r.status === 400 ? ok('batch respeita limite de empréstimos configurado') : fail('batch limite', r);

    r = await j('/api/loans/batch', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ readerId, bookIds: [] }),
    });
    r.status === 400 ? ok('batch rejeita seleção vazia') : fail('batch seleção vazia', r);

    r = await j('/api/dashboard', { headers: auth(adminToken!) });
    if (r.status === 200 && r.body.totalBooks > 0) ok('dashboard');
    else fail('dashboard', r);

    r = await j('/api/reports?type=acervo', { headers: auth(adminToken!) });
    r.status === 200 && r.body?.columns?.length > 0 ? ok('relatório acervo') : fail('relatório acervo', r);

    r = await j('/api/reports?type=acervo', { headers: auth(attendantToken) });
    r.status === 403 ? ok('RBAC: atendente sem relatórios') : fail('RBAC atendente relatórios', r);

    r = await j('/api/audit?pageSize=5', { headers: auth(adminToken!) });
    r.status === 200 && Array.isArray(r.body?.items) ? ok('auditoria') : fail('auditoria', r);

    r = await j('/api/users', { headers: auth(attendantToken) });
    r.status === 403 ? ok('RBAC: atendente sem usuários') : fail('RBAC atendente usuários', r);

    r = await j('/api/settings', {
      method: 'PUT',
      headers: auth(adminToken!),
      body: JSON.stringify({ loanLimit: 4, defaultLoanDays: 15, maxRenewals: 1, libraryName: 'Biblioteca Smoke Test' }),
    });
    r.status === 200 ? ok('atualizar configurações') : fail('atualizar configurações', r);

    r = await j('/api/reservations', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ readerId, bookId }),
    });
    const reservationId = r.body?.$id;
    if (r.status === 201) {
      ok('criar reserva');
      r = await j('/api/reservations/' + reservationId + '/cancel', { method: 'POST', headers: auth(adminToken!) });
      r.status === 200 ? ok('cancelar reserva') : fail('cancelar reserva', r);
    } else fail('criar reserva', r);

    r = await j('/api/books', { method: 'POST', headers: auth(attendantToken), body: JSON.stringify({ title: 'Livro Sem Auth OK' }) });
    r.status === 201 ? ok('atendente pode criar livro') : fail('atendente criar livro', r);

    r = await j('/api/subjects', { method: 'POST', headers: auth(attendantToken), body: JSON.stringify({ name: 'X' }) });
    r.status === 403 ? ok('RBAC: atendente sem assuntos') : fail('RBAC atendente assuntos', r);

    r = await j('/api/books/novo/livro');
    r.status === 404 ? ok('rota inválida → 404') : fail('rota inválida 404', r);

    const bookA10 = genIsbn10('857522429');
    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro ISBN Teste A', isbn10: '857-522-429-8' }),
    });
    const bookA = r.body?.$id;
    if (bookA) { ok('criar livro com ISBN-10'); createdBookIds.push(bookA); } else fail('criar livro ISBN-10', r);

    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro ISBN Teste B', isbn10: '857 522 4298' }),
    });
    r.status === 409 &&
    r.body?.code === 'BOOK_ALREADY_EXISTS' &&
    r.body?.duplicate?.id === bookA &&
    r.body?.duplicate?.titulo === 'Livro ISBN Teste A'
      ? ok('bloquear ISBN-10 duplicado (formatação diferente)')
      : fail('bloquear ISBN-10 duplicado', r);

    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro ISBN Teste C', isbn10: '123456789X' }),
    });
    const bookC = r.body?.$id;
    if (bookC) { ok('criar livro ISBN-10 (X maiúsculo)'); createdBookIds.push(bookC); } else fail('criar livro ISBN-10 X', r);

    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro ISBN Teste B', isbn10: '123456789x' }),
    });
    r.status === 409 && r.body?.duplicate?.id === bookC
      ? ok('bloquear ISBN-10 duplicado (caixa)')
      : fail('bloquear ISBN-10 duplicado (caixa)', r);

    const bookD13 = genIsbn13('978' + String(Date.now()).slice(-9));
    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro ISBN Teste D', isbn13: bookD13 }),
    });
    const bookD = r.body?.$id;
    if (bookD) { ok('criar livro com ISBN-13'); createdBookIds.push(bookD); } else fail('criar livro ISBN-13', r);

    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro ISBN Teste E', isbn13: fmtIsbn13(bookD13) }),
    });
    r.status === 409 && r.body?.duplicate?.id === bookD
      ? ok('bloquear ISBN-13 duplicado (formatação diferente)')
      : fail('bloquear ISBN-13 duplicado', r);

    r = await j('/api/books/' + bookD, {
      method: 'PUT',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro ISBN Teste D', isbn13: bookD13 }),
    });
    r.status === 200 ? ok('editar próprio livro mantém ISBN') : fail('editar próprio ISBN', r);

    r = await j('/api/books/' + bookD, {
      method: 'PUT',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro ISBN Teste D', isbn10: '8575224298' }),
    });
    r.status === 409 && r.body?.duplicate?.id === bookA
      ? ok('edição bloqueada com ISBN de outro livro')
      : fail('edição bloqueada', r);

    r = await j('/api/books/exists?isbn=8575224298', { headers: auth(adminToken!) });
    r.status === 200 && r.body?.book?.$id === bookA
      ? ok('check exists ISBN-10')
      : fail('check exists', r);

    r = await j('/api/books/exists?isbn=8575224298&exclude=' + bookA, { headers: auth(adminToken!) });
    r.status === 200 && r.body?.book === null
      ? ok('check exists exclui registro atual na edição')
      : fail('check exists exclude', r);

    r = await j('/api/books/exists?isbn=' + bookA10, { headers: auth(adminToken!) });
    r.status === 200 && r.body?.book?.$id === bookA
      ? ok('check exists ISBN-10 com espaços')
      : fail('check exists espaços', r);

    const anIsbnA = genIsbn13('978' + String(Date.now() + 3).slice(-9));
    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro AutorName Smoke A', isbn13: anIsbnA, authorNames: ['Autor Novo Smoke A'] }),
    });
    const anBookId = r.body?.$id;
    if (r.status === 201 && anBookId) {
      ok('livro criado com autor novo (authorNames)');
      createdBookIds.push(anBookId);
      const detail = await j('/api/books/' + anBookId);
      const hasA = detail.body?.authorNames?.includes('Autor Novo Smoke A');
      hasA ? ok('autor novo vinculado ao livro') : fail('vínculo autor novo', detail);
    } else fail('livro com autor novo', r);

    r = await j('/api/authors?search=Autor Novo Smoke', { headers: auth(adminToken!) });
    r.status === 200 && r.body?.items?.some((a: any) => a.name === 'Autor Novo Smoke A')
      ? ok('autor novo cadastrado na lista de autores')
      : fail('autor na lista', r);
    const authorANameId = r.body?.items?.find((a: any) => a.name === 'Autor Novo Smoke A')?.$id;

    const anIsbnB = genIsbn13('978' + String(Date.now() + 4).slice(-9));
    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro AutorName Smoke B', isbn13: anIsbnB, authorNames: ['autor novo smoke a'] }),
    });
    if (r.status === 201) {
      createdBookIds.push(r.body.$id);
      const dup = await j('/api/authors?all=1', { headers: auth(adminToken!) });
      const count = dup.body?.items?.filter((a: any) => a.name.toLowerCase() === 'autor novo smoke a').length;
      count === 1 ? ok('nome com caixa diferente reutiliza autor sem duplicar') : fail('reutilização de autor', dup);
      const detailB = await j('/api/books/' + r.body.$id);
      const linked = detailB.body?.authorIds?.includes(authorANameId);
      linked ? ok('livro B vinculado ao mesmo autor') : fail('vínculo livro B', detailB);
    } else fail('livro com autor reutilizado', r);

    r = await j('/api/books/' + anBookId, {
      method: 'PUT',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro AutorName Smoke A', isbn13: anIsbnA, authorIds: [authorANameId], authorNames: ['Autor Novo Smoke B'] }),
    });
    r.status === 200 &&
    r.body?.authorNames?.includes('Autor Novo Smoke A') &&
    r.body?.authorNames?.includes('Autor Novo Smoke B')
      ? ok('edição mantém autor e adiciona autor novo')
      : fail('edição com autor novo', r);

    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro AutorName Smoke C', authorNames: ['X'] }),
    });
    r.status === 400 ? ok('authorNames rejeita nome muito curto') : fail('authorNames curto', r);

    const anIsbnD = genIsbn13('978' + String(Date.now() + 5).slice(-9));
    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({
        title: 'Livro AutorName Smoke D',
        isbn13: anIsbnD,
        authorNames: ['Autor Novo Smoke C', 'Autor Novo Smoke D'],
      }),
    });
    if (r.status === 201) {
      createdBookIds.push(r.body.$id);
      const detailD = await j('/api/books/' + r.body.$id);
      const hasC = detailD.body?.authorNames?.includes('Autor Novo Smoke C');
      const hasD = detailD.body?.authorNames?.includes('Autor Novo Smoke D');
      hasC && hasD ? ok('authorNames com lista cria todos os autores') : fail('authorNames lista', detailD);
    } else fail('livro com lista de autores', r);

    const cnIsbn = genIsbn13('978' + String(Date.now() + 6).slice(-9));
    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({
        title: 'Livro Assunto Smoke A',
        isbn13: cnIsbn,
        subjectNames: ['Assunto Smoke Test B', 'Assunto Smoke Test C'],
      }),
    });
    if (r.status === 201) {
      createdBookIds.push(r.body.$id);
      const detailCat = await j('/api/books/' + r.body.$id);
      const hasB = detailCat.body?.subjectNames?.includes('Assunto Smoke Test B');
      const hasC = detailCat.body?.subjectNames?.includes('Assunto Smoke Test C');
      hasB && hasC ? ok('subjectNames com lista cria e vincula todos os assuntos') : fail('subjectNames lista', detailCat);
    } else fail('livro com assuntos novos', r);

    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro Assunto Smoke B', subjectNames: ['X'] }),
    });
    r.status === 400 ? ok('subjectNames rejeita nome muito curto') : fail('subjectNames curto', r);

    const cnIsbn2 = genIsbn13('978' + String(Date.now() + 7).slice(-9));
    r = await j('/api/books', {
      method: 'POST',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro Assunto Smoke C', isbn13: cnIsbn2, subjectNames: ['Assunto Smoke Test B'] }),
    });
    const cnId = r.body?.$id;
    if (cnId) { ok('livro com assunto novo fixture'); createdBookIds.push(cnId); } else fail('livro assunto novo', r);
    r = await j('/api/books/' + cnId, {
      method: 'PUT',
      headers: auth(adminToken!),
      body: JSON.stringify({ title: 'Livro Assunto Smoke C', isbn13: cnIsbn2, subjectNames: ['Assunto Smoke Test B', 'Assunto Smoke Test D'] }),
    });
    r.status === 200 &&
    r.body?.subjectNames?.includes('Assunto Smoke Test B') &&
    r.body?.subjectNames?.includes('Assunto Smoke Test D')
      ? ok('edição mantém assunto e adiciona assunto novo')
      : fail('edição com assunto novo', r);
  } catch (err) {
    fail('exceção global', err);
  } finally {
    const safeDel = async (collection: CollectionId, id: string) => {
      try { await deleteDoc(collection, id); } catch { /* best-effort */ }
    };

    for (const id of createdBookIds) await safeDel(COLLECTIONS.books, id);
    for (const id of createdLoanIds) await safeDel(COLLECTIONS.loans, id);
    for (const id of createdReaderIds) await safeDel(COLLECTIONS.readers, id);

    const books = (await listDocs(COLLECTIONS.books, { pageSize: 1000 })).docs;
    for (const b of books) {
      if (SMOKE_BOOK_PREFIXES.some((p) => b.title?.startsWith(p)) || createdBookIds.includes(b.$id)) {
        await safeDel(COLLECTIONS.books, b.$id);
      }
    }
    const readers = (await listDocs(COLLECTIONS.readers, { pageSize: 1000 })).docs;
    for (const rd of readers) {
      if (rd.email === SMOKE_READER_EMAIL || createdReaderIds.includes(rd.$id)) {
        await safeDel(COLLECTIONS.readers, rd.$id);
      }
    }
    const loans = (await listDocs(COLLECTIONS.loans, { pageSize: 1000 })).docs;
    for (const l of loans) {
      if (createdLoanIds.includes(l.$id) || createdBookIds.includes(l.bookId) || createdReaderIds.includes(l.readerId)) {
        await safeDel(COLLECTIONS.loans, l.$id);
      }
    }
    const reservations = (await listDocs(COLLECTIONS.reservations, { pageSize: 1000 })).docs;
    for (const r of reservations) {
      if (createdReaderIds.includes(r.readerId) || createdBookIds.includes(r.bookId)) {
        await safeDel(COLLECTIONS.reservations, r.$id);
      }
    }
    const authors = (await listDocs(COLLECTIONS.authors, { pageSize: 1000 })).docs;
    for (const a of authors) {
      if (SMOKE_AUTHORS.includes(a.name)) await safeDel(COLLECTIONS.authors, a.$id);
    }
    const subjects = (await listDocs(COLLECTIONS.subjects, { pageSize: 1000 })).docs;
    for (const c of subjects) {
      if (SMOKE_SUBJECTS.includes(c.name)) await safeDel(COLLECTIONS.subjects, c.$id);
    }

    if (attendantUserId) {
      try {
        await j('/api/users/' + attendantUserId, { method: 'PUT', headers: auth(adminToken!), body: JSON.stringify({ status: 'INACTIVE' }) });
      } catch {}
    }
    try {
      await j('/api/settings', { method: 'PUT', headers: auth(adminToken!), body: JSON.stringify({ loanLimit: 3, defaultLoanDays: 14, maxRenewals: 1, libraryName: '' }) });
    } catch {}
    server.close();
  }

  console.log(`\nSmoke: ${passed} passaram, ${failed} falharam`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
