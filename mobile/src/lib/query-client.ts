/**
 * TanStack Query client: caches server data and handles loading/error states.
 * Retries only connection problems and 5xx errors (never 4xx — those won't fix themselves).
 */
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/api-error';

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) return error.isNetworkProblem || error.status >= 500;
  return false;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
}
