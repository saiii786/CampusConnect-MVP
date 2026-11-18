/**
 * Minimal HTTP client for the backend (fetch-based, no extra dependency).
 *
 *   const health = await api.get<HealthResponse>('/health', { auth: false });
 *
 * - Sends/receives JSON; converts every failure into ApiError (see api-error.ts).
 * - Timeout per request (the free hosting tier can take ~60 s to wake up, so callers that
 *   may hit a sleeping server pass a longer timeout).
 * - Auth (T1.7): when an AuthProvider is registered (lib/auth/session.ts does this), requests
 *   carry `Authorization: Bearer <access token>`. If the server answers 401 AUTH_TOKEN_INVALID
 *   the client refreshes the session ONCE and retries; if that fails the error is passed on
 *   (and the session layer signs the user out). Pass `auth: false` for public endpoints.
 */
import { getApiBaseUrl } from '@/config/api-url';
import { ApiError, isApiErrorBody } from './api-error';

export const DEFAULT_TIMEOUT_MS = 20_000;

export interface RequestOptions {
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Attach the access token and auto-refresh on 401. Default true. */
  auth?: boolean;
}

/** Supplies access tokens to the client. Implemented by the session layer. */
export interface AuthProvider {
  /** A currently valid access token, refreshing first if it is about to expire. Null = signed out. */
  getAccessToken(): Promise<string | null>;
  /** Force a refresh after the server rejected a token. Null = could not refresh (signed out). */
  refreshAccessToken(): Promise<string | null>;
}

type FetchLike = typeof fetch;

/** Create a client. `baseUrl`/`fetchImpl` are injectable for tests. */
export function createApiClient(
  getBaseUrl: () => string = getApiBaseUrl,
  fetchImpl: FetchLike = (...args) => fetch(...args),
) {
  let authProvider: AuthProvider | null = null;

  async function send<T>(method: string, path: string, options: RequestOptions, accessToken: string | null): Promise<T> {
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
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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

  async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const useAuth = options.auth !== false && authProvider !== null;
    const token = useAuth ? await authProvider!.getAccessToken() : null;
    try {
      return await send<T>(method, path, options, token);
    } catch (error) {
      // Access token rejected (expired early, server secret rotated…) → refresh once and retry.
      if (useAuth && token && error instanceof ApiError && error.status === 401 && error.code === 'AUTH_TOKEN_INVALID') {
        const fresh = await authProvider!.refreshAccessToken();
        if (fresh) return send<T>(method, path, options, fresh);
      }
      throw error;
    }
  }

  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('POST', path, { ...options, body }),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('PATCH', path, { ...options, body }),
    delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
    /** Called once by the session layer at startup. */
    setAuthProvider(provider: AuthProvider | null) {
      authProvider = provider;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The app-wide client. */
export const api = createApiClient();
