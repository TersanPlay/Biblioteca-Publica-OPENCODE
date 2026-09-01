import { AxiosError } from 'axios';

export class ApiError extends Error {
  status: number;
  details?: Record<string, string>;

  constructor(message: string, status: number, details?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function apiErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as
      | { error?: string; message?: string; details?: Record<string, string> }
      | undefined;
    if (data?.details) {
      const first = Object.values(data.details)[0];
      if (first) return first;
    }
    if (data?.error) return data.error;
    if (data?.message) return data.message;
    if (err.code === 'ERR_NETWORK') return 'Não foi possível conectar ao servidor.';
    return err.message || 'Erro inesperado.';
  }
  if (err instanceof Error) return err.message;
  return 'Erro inesperado.';
}
