/**
 * Server status (backend GET /health). Used by the welcome screen's status card so a
 * developer or tester can see immediately whether the phone can reach the API.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from './client';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptimeSeconds: number;
  timestamp: string;
}

/** Free-tier servers sleep when idle and can take up to ~60 s to wake. */
const WAKE_UP_TIMEOUT_MS = 70_000;

export function useServerHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<HealthResponse>('/health', { timeoutMs: WAKE_UP_TIMEOUT_MS, auth: false }),
    retry: false,
  });
}
