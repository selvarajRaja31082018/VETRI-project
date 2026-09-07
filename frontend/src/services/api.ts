import axios, { AxiosError } from 'axios';
import type { ApiErrorBody } from '../types';

const TOKEN_KEY = 'vetri.token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 20000,
});

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Normalised client-side error so components never touch axios internals. */
export class ApiClientError extends Error {
  code: string;
  status: number;
  details: Array<{ field: string; message: string }>;

  constructor(status: number, code: string, message: string, details: Array<{ field: string; message: string }> = []) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401 && onUnauthorized) onUnauthorized();
      const body = data?.error;
      return Promise.reject(
        new ApiClientError(
          status,
          body?.code || 'UNKNOWN_ERROR',
          body?.message || 'Something went wrong. Please try again.',
          body?.details || [],
        ),
      );
    }
    if (error.request) {
      return Promise.reject(
        new ApiClientError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.'),
      );
    }
    return Promise.reject(new ApiClientError(0, 'UNKNOWN_ERROR', error.message));
  },
);
