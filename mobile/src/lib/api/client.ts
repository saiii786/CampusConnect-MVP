/**
 * Minimal HTTP client for the backend (fetch-based, no extra dependency).
 *
 *   const health = await api.get<HealthResponse>('/health');
 *
 * - Sends/receives JSON; converts every failure into ApiError (see api-error.ts).
 * - Timeout per request (the free hosting tier can take ~60 s to wake up, so callers that
 *   may hit a sleeping server pass a longer timeout).
 * - Auth headers and automatic token refresh are added in Phase 1 (T1.7).
 */
import { getApiBaseUrl } from '@/config/api-url';
import { ApiError, isApiErrorBody } from './api-error';

export const DEFAULT_TIMEOUT_MS = 20_000;

export interface RequestOptions {
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

type FetchLike = typeof fetch;

/** Create a client. `baseUrl`/`fetchImpl` are injectable for tests. */
export function createApiClient(
  getBaseUrl: () => string = getApiBaseUrl,
  fetchImpl: FetchLike = (...args) => fetch(...args),
) {
  async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    options.signal?.addEventListener('abort', () => controller.abort());

    let response: Response;
    try {
      response = await fetchImpl(`${getBaseUrl()}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      if (timedOut) throw new ApiError(0, 'TIMEOUT', 'Request timed out');
      throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      if (isApiErrorBody(data)) {
        const e = data.error;
        throw new ApiError(response.status, e.code, e.message, e.details, e.requestId);
      }
      throw new ApiError(response.status, 'UNEXPECTED_RESPONSE', `Server error (${response.status})`);
    }
    return data as T;
  }

  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('POST', path, { ...options, body }),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('PATCH', path, { ...options, body }),
    delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The app-wide client. */
export const api = createApiClient();
