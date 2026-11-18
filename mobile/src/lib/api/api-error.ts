/**
 * Every failed API call becomes an ApiError, so screens handle one error type.
 * Mirrors the backend's standard error body (docs/ARCHITECTURE.md §8).
 */
export interface ApiErrorBody {
  error: { code: string; message: string; details: unknown; requestId: string | null };
}

export class ApiError extends Error {
  constructor(
    /** HTTP status; 0 when the server could not be reached. */
    public readonly status: number,
    /** Stable machine-readable code, e.g. VALIDATION_FAILED, NETWORK_ERROR, TIMEOUT. */
    public readonly code: string,
    message: string,
    public readonly details: unknown = null,
    public readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True for problems with the connection rather than with the request. */
  get isNetworkProblem(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  const err = (value as ApiErrorBody | null)?.error;
  return typeof err?.code === 'string' && typeof err?.message === 'string';
}

/** A short, human message for any error (used by ErrorState and alerts). */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR') return "Can't reach the server. Check your internet connection.";
    if (error.code === 'TIMEOUT') return 'The server is taking too long to respond. Please try again.';
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
