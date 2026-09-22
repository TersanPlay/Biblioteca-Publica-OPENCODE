import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

interface FunctionEnvelope {
  status: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
}

function isEnvelope(raw: unknown): raw is FunctionEnvelope {
  if (!raw || typeof raw !== 'object') return false;
  const e = raw as Record<string, unknown>;
  return (
    typeof e.status === 'number' &&
    typeof e.headers === 'object' &&
    e.headers !== null &&
    typeof e.body === 'string' &&
    typeof e.isBase64Encoded === 'boolean'
  );
}

function base64ToBlob(b64: string, type: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes as unknown as BlobPart], { type });
}

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Decodifica envelope `{status,headers,body,isBase64Encoded}` produzido pelo
 * bridge da Appwrite Function. Ativo em runtime (produção via rewrite `/api`
 * do Vercel para o domínio da Function). No dev (proxy Vite para localhost)
 * o backend responde body puro — passa direto.
 */
function envelopeData(raw: unknown, responseType?: string): { data: unknown; headers: Record<string, string>; status: number } {
  if (!isEnvelope(raw)) return { data: raw, headers: {}, status: 200 };
  if (responseType === 'blob') {
    const type = raw.headers['content-type'] || 'application/octet-stream';
    if (raw.isBase64Encoded) return { data: base64ToBlob(raw.body, type), headers: raw.headers, status: raw.status };
    return { data: new Blob([raw.body], { type }), headers: raw.headers, status: raw.status };
  }
  if (!raw.body) return { data: '', headers: raw.headers, status: raw.status };
  try {
    return { data: JSON.parse(raw.body), headers: raw.headers, status: raw.status };
  } catch {
    return { data: raw.body, headers: raw.headers, status: raw.status };
  }
}

function envelopeError(raw: unknown, config: InternalAxiosRequestConfig): AxiosError {
  const { data, status } = envelopeData(raw, (config as AxiosRequestConfig).responseType);
  return new AxiosError(
    typeof data === 'string' ? data : JSON.stringify(data),
    undefined,
    config,
    null,
    {
      data,
      status,
      statusText: String(status),
      headers: isEnvelope(raw) ? raw.headers : {},
      config,
    } as AxiosResponse,
  );
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
  (response) => {
    const decoded = envelopeData(response.data, response.config.responseType);
    if (decoded.status >= 400) {
      throw envelopeError(response.data, response.config);
    }
    response.data = decoded.data;
    return response;
  },
  (error) => {
    if (error?.response?.status === 401 && !error?.config?.url?.includes('/auth/login')) {
      setToken(null);
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  },
);