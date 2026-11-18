/**
 * TanStack Query client: caches server data and handles loading/error states.
 * Retries only connection problems and 5xx errors (never 4xx — those won't fix themselves).
 *
 * React Native wiring (Phase 9, T9.1) — TanStack Query only knows "online" and "focused" in browsers:
 * - onlineManager ← NetInfo: while offline, queries pause instead of failing, and resume on reconnect.
 * - focusManager ← AppState: returning to the app refetches stale data on screen.
 */
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { ApiError } from './api/api-error';

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) return error.isNetworkProblem || error.status >= 500;
  return false;
}

/** Connect TanStack Query to the phone's network and app state. Call once at start-up. */
export function connectQueryToDevice(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      // isInternetReachable is null while unknown — only treat an explicit false as offline.
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
    }),
  );
  if (Platform.OS !== 'web') {
    focusManager.setEventListener((setFocused) => {
      const sub = AppState.addEventListener('change', (s) => setFocused(s === 'active'));
      return () => sub.remove();
    });
  }
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
}
