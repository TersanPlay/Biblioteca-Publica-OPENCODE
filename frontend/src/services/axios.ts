import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';

const FUNCTION_ENDPOINT: string | null =
  import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.startsWith('http')
    ? import.meta.env.VITE_API_URL
    : null;

interface FunctionEnvelope {
  status: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
}

interface AppwriteExecutionPayload {
  statusCode: number;
  body: unknown;
  headers?: Record<string, string>;
}

function normalizeEnvelope(raw: unknown): FunctionEnvelope {
  if (raw && typeof raw === 'object' && 'status' in raw) {
    const e = raw as FunctionEnvelope;
    return {
      status: e.status,
      headers: e.headers ?? {},
      body: String(e.body ?? ''),
      isBase64Encoded: Boolean(e.isBase64Encoded),
    };
  }
  const exec = raw as AppwriteExecutionPayload;
  return {
    status: exec.statusCode,
    headers: exec.headers ?? {},
    body: typeof exec.body === 'string' ? exec.body : JSON.stringify(exec.body ?? ''),
    isBase64Encoded: false,
  };
}

function base64ToBlob(b64: string, type: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes as unknown as BlobPart], { type });
}

function envelopeToData(envelope: FunctionEnvelope, responseType?: string): unknown {
  if (responseType === 'blob') {
    if (envelope.isBase64Encoded) {
      const type = envelope.headers['content-type'] || 'application/octet-stream';
      return base64ToBlob(envelope.body, type);
    }
    return new Blob([envelope.body]);
  }
  if (!envelope.body) return '';
  try {
    return JSON.parse(envelope.body);
  } catch {
    return envelope.body;
  }
}

function appendTypeParam(url: string): string {
  return url.includes('?') ? `${url}&type=json` : `${url}?type=json`;
}

/**
 * Adapter que conversa com o backend Express exposto como Appwrite Function.
 * Todos os responses viajam num envelope JSON `{status,headers,body,isBase64Encoded}`.
 * Só é ativado quando VITE_API_URL aponta para o domínio da Function; no dev
 * (proxy Vite /api) o axios padrão é usado.
 */
const appwriteAdapter: AxiosAdapter = async (config) => {
  const fullUrl = axios.getUri(config);
  const url = appendTypeParam(fullUrl);

  const headers: Record<string, string> = {};
  const cfgHeaders = config.headers as Record<string, unknown> | undefined;
  if (cfgHeaders) {
    for (const [k, v] of Object.entries(cfgHeaders)) {
      if (typeof v === 'string') headers[k.toLowerCase()] = v;
    }
  }

  const method = (config.method ?? 'get').toUpperCase();
  const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const bodyData = hasBody ? (config.data as string | undefined) : undefined;

  const fetchOptions: RequestInit = {
    method,
    headers,
    signal: config.signal as AbortSignal | null | undefined,
    body: bodyData,
  };

  const res = await fetch(url, fetchOptions);
  const raw = (await res.json()) as unknown;
  const envelope = normalizeEnvelope(raw);

  const data = envelopeToData(envelope, config.responseType);

  if (envelope.status >= 400) {
    const error = new AxiosError(
      typeof data === 'string' ? data : JSON.stringify(data),
      undefined,
      config,
      null,
      {
        data,
        status: envelope.status,
        statusText: String(envelope.status),
        headers: envelope.headers,
        config,
      } as AxiosResponse,
    );
    throw error;
  }

  return {
    data,
    status: envelope.status,
    statusText: String(envelope.status),
    headers: envelope.headers,
    config,
    request: res,
  };
};

export const api = axios.create({
  baseURL: FUNCTION_ENDPOINT || '/api',
  headers: { 'Content-Type': 'application/json' },
});

if (FUNCTION_ENDPOINT) {
  api.defaults.adapter = appwriteAdapter;
}

const TOKEN_KEY = 'livraria_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !error?.config?.url?.includes('/auth/login')) {
      setToken(null);
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  },
);