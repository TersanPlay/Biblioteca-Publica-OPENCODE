import { isValidIsbn10, isValidIsbn13 } from '../validation';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export function isbn13To10(isbn13: string): string | null {
  const digits = isbn13.replace(/[\s-]/g, '');
  if (!/^\d{13}$/.test(digits) || !digits.startsWith('978')) return null;
  const body = digits.slice(3, 12);
  const sum = body.split('').reduce((acc, c, i) => acc + Number(c) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return body + (check === 10 ? 'X' : String(check));
}

export interface ResolvedBookInfo {
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
}

function stripTags(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&rlm;|&lrm;|&#8206;|&#8207;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const DETAIL_LABELS =
  'Editora|Data da publica\u00e7\u00e3o|Idioma|N\u00famero de p\u00e1ginas|ISBN-10|ISBN-13|ISBN|Peso|Dimens\u00f5es|Ranking';

function detailText(html: string): string | null {
  const start = html.indexOf('detailBulletsWrapper_feature_div');
  if (start === -1) return null;
  const text = stripTags(html.slice(start, start + 12000));
  const cut = text.indexOf('Ranking dos mais vendidos');
  return (cut !== -1 ? text.slice(0, cut) : text).trim();
}

function extractDetail(text: string, label: string): string | null {
  const re = new RegExp(`(?:${label})\\s*:?\\s*(.*?)(?=(?:${DETAIL_LABELS})\\s*:|$)`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function splitTitle(full: string): { title: string; subtitle: string | null } {
  const [head, ...rest] = full.split(':');
  if (rest.length === 0) return { title: head.trim(), subtitle: null };
  return { title: head.trim(), subtitle: rest.join(':').trim() };
}

function extractDescription(html: string): string | null {
  const blurb = html.match(
    /<div[^>]*data-a-expander-name=["']book_description_expander["'][^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i,
  );
  if (blurb) {
    const text = stripTags(blurb[1]);
    if (text) return text;
  }
  const meta = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  return meta ? meta[1].trim() : null;
}

function extractAuthors(html: string): string[] {
  const names = new Set<string>();
  const push = (raw: string) => {
    const name = raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (name && name.length > 1 && !/^[A-Z0-9 ]{1,3}$/i.test(name)) names.add(name);
  };
  const patterns = [
    /contributorNameID[^>]*>([\s\S]*?)<\/(?:a|span)>/gi,
    /(?:bylineInfo_feature_div[\s\S]{0,2000}?)?(?:class=["']author(?: notFaded)?["'][^>]*>)([\s\S]*?)<\/(?:a|span)>/gi,
  ];
  for (const pattern of patterns) {
    for (const m of html.matchAll(pattern)) {
      if (m[1]) push(m[1]);
    }
  }
  const out: string[] = [];
  for (const p of names) {
    for (const piece of p.split(',')) {
      const clean = piece.trim();
      if (clean && !out.some((x) => x.toLowerCase() === clean.toLowerCase())) out.push(clean);
    }
  }
  return out.slice(0, 8);
}

function extractIsbn13(html: string, details: string | null): string | null {
  const raw = details ?? html;
  const m = raw.match(/ISBN-13\s*:?\s*([\dXx][\dXx\- ]{10,18})/i);
  if (m) {
    const candidate = m[1].replace(/[^\dXx]/g, '');
    if (isValidIsbn13(candidate)) return candidate;
  }
  return null;
}

export function extractInfo(html: string): ResolvedBookInfo | null {
  const coverUrl = bestCover(html);
  if (!coverUrl) return null;
  let full: string | null = null;
  const span = html.match(/<span[^>]*id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
  if (span) full = span[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (!full) {
    const tag = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (tag) full = tag[1].replace(/\s*\| Amazon.*$/i, '').trim();
  }
  const { title, subtitle } = full ? splitTitle(full) : { title: null, subtitle: null };
  const details = detailText(html);
  const publisher = details ? extractDetail(details, 'Editora') : null;
  const pubDate = details ? extractDetail(details, 'Data da publica\u00e7\u00e3o') : null;
  const yearMatch = pubDate?.match(/\b(?:19|20)\d{2}\b/);
  const pagesMatch = details ? extractDetail(details, 'N\u00famero de p\u00e1ginas') : null;
  return {
    coverUrl,
    title,
    subtitle,
    isbn13: extractIsbn13(html, details),
    description: extractDescription(html),
    publisher,
    publicationYear: yearMatch ? Number(yearMatch[0]) : null,
    pages: pagesMatch ? Number(pagesMatch.match(/\d+/)?.[0]) || null : null,
    authors: extractAuthors(html),
    categories: [],
  };
}

function bestCover(html: string): string | null {
  const seen = new Map<string, { url: string; size: number }>();
  const re = /https:\/\/m\.media-amazon\.com\/images\/I\/([A-Za-z0-9]{8,15})\.[^"'()\s]+?\.jpg/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = m[0];
    const hash = m[1];
    const sizes = (url.match(/_(?:SL|SX|SY|UX|UY)(\d+)_/g) || []).map((s) =>
      parseInt(s.replace(/\D/g, ''), 10),
    );
    const size = sizes.length > 0 ? Math.max(...sizes) : 0;
    const prev = seen.get(hash);
    if (!prev || size > prev.size) seen.set(hash, { url, size });
  }
  let best: { url: string; size: number } | null = null;
  for (const v of seen.values()) {
    if (!best || v.size > best.size) best = v;
  }
  return best && best.size > 0 ? best.url : null;
}

async function fetchAmazon(url: string, asin: string): Promise<ResolvedBookInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const m = res.url.match(/\/dp\/([A-Z0-9]{10})/i);
    if (!m || m[1].toUpperCase() !== asin.toUpperCase()) return null;
    return extractInfo(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveAmazonCover(isbn: string): Promise<ResolvedBookInfo | null> {
  const digits = isbn.replace(/[\s-]/g, '');
  const isbn10 = isValidIsbn10(digits)
    ? digits.toUpperCase()
    : isValidIsbn13(digits)
      ? isbn13To10(digits)
      : null;
  if (!isbn10) return null;
  const candidates = [
    `https://www.amazon.com.br/dp/${isbn10}`,
    `https://www.amazon.com/dp/${isbn10}`,
  ];
  for (const url of candidates) {
    const info = await fetchAmazon(url, isbn10);
    if (info) return info;
  }
  return null;
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function cleanCategoryList(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const item of list) {
    const name = typeof item === 'string' ? item.trim() : (item as { name?: string })?.name?.trim();
    if (!name || name.length < 2) continue;
    if (!out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out;
}

export async function resolvePublicCategories(
  isbn: string,
  title: string | null,
): Promise<string[]> {
  const attempts: Promise<string[]>[] = [
    (async () => {
      const json = await fetchJson(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`,
        6000,
      );
      if (!json || typeof json !== 'object') return [];
      const entry = Object.values(json as Record<string, unknown>)[0] as
        | { subjects?: unknown }
        | undefined;
      return cleanCategoryList(entry?.subjects);
    })(),
    (async () => {
      const json = await fetchJson(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`,
        6000,
      );
      if (!json || typeof json !== 'object') return [];
      const items = (json as { items?: unknown[] }).items;
      const categories = (items?.[0] as { volumeInfo?: { categories?: unknown } } | undefined)
        ?.volumeInfo?.categories;
      return cleanCategoryList(categories);
    })(),
  ];
  if (title) {
    attempts.push(
      (async () => {
        const json = await fetchJson(
          `https://gutendex.com/books?search=${encodeURIComponent(title)}`,
          6000,
        );
        if (!json || typeof json !== 'object') return [];
        const results = (json as { results?: unknown[] }).results;
        const subjects = (results?.[0] as { subjects?: unknown } | undefined)?.subjects;
        return cleanCategoryList(subjects);
      })(),
    );
  }
  const settled = await Promise.all(attempts);
  for (const list of settled) {
    if (list.length > 0) return list.slice(0, 6);
  }
  return [];
}

export async function resolveBookMetadata(isbn: string): Promise<ResolvedBookInfo | null> {
  const info = await resolveAmazonCover(isbn);
  if (!info) return null;
  info.categories = await resolvePublicCategories(isbn, info.title);
  return info;
}