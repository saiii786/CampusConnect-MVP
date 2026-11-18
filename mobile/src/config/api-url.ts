/**
 * Resolves the backend API base URL (no hard-coded IPs — the old apps broke on every
 * Wi-Fi change).
 *
 * Priority:
 *  1. EXPO_PUBLIC_API_URL from mobile/.env (always wins; required for preview/production builds)
 *  2. Development only: the computer running the Expo dev server, taken from
 *     Constants.expoConfig.hostUri (e.g. "192.168.1.5:8081") → http://192.168.1.5:3000/api/v1
 *
 * Note: EXPO_PUBLIC_ variables are embedded in the app — never put secrets in them.
 */
import Constants from 'expo-constants';

export const API_PORT_IN_DEV = 3000;
export const API_PATH = '/api/v1';

export class ApiUrlNotConfiguredError extends Error {
  constructor() {
    super(
      'API address is not configured. Set EXPO_PUBLIC_API_URL in mobile/.env ' +
        '(see mobile/.env.example).',
    );
    this.name = 'ApiUrlNotConfiguredError';
  }
}

/** Pure function (exported for tests): decide the URL from explicit config + dev host. */
export function resolveApiBaseUrl(
  explicitUrl: string | undefined,
  devHostUri: string | undefined | null,
  isDev: boolean,
): string {
  if (explicitUrl && explicitUrl.trim()) {
    return explicitUrl.trim().replace(/\/+$/, '');
  }
  if (isDev && devHostUri) {
    const host = devHostUri.split(':')[0];
    if (host) return `http://${host}:${API_PORT_IN_DEV}${API_PATH}`;
  }
  throw new ApiUrlNotConfiguredError();
}

let cached: string | undefined;

/** The API base URL for this app run (computed once). */
export function getApiBaseUrl(): string {
  cached ??= resolveApiBaseUrl(
    // Must be written out in full so Expo can inline it at build time.
    process.env.EXPO_PUBLIC_API_URL,
    Constants.expoConfig?.hostUri,
    __DEV__,
  );
  return cached;
}
