/**
 * Session state and lifecycle (T1.7, FR-002).
 *
 *   useSession((s) => s.status)      'restoring' | 'signedIn' | 'signedOut' | 'restoreFailed'
 *   useSession((s) => s.user)        MeResponse | null
 *   session.signIn(response)         after signup/login
 *   session.signOut()                revoke on server (best effort) + forget locally
 *   session.restore()                on app start: refresh token from secure storage → new session
 *
 * Token rules:
 *   - access token: memory only; refreshed 30 s before expiry or after a 401.
 *   - refresh token: secure storage; single-use (server rotates it on every refresh).
 *   - SINGLE-FLIGHT refresh: concurrent callers share one refresh request. Sending the same
 *     refresh token twice would look like token theft to the server and end the session.
 *   - Refresh rejected (401/403) → signed out. Network failure → stay signed in, caller sees the error.
 */
import type { AuthSessionResponse, MeResponse } from '@cc/shared';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { ApiError } from '@/lib/api/api-error';
import { api as defaultApi, type ApiClient } from '@/lib/api/client';
import { secureSessionStorage, type SessionStorage } from './session-storage';

export type SessionStatus = 'restoring' | 'signedIn' | 'signedOut' | 'restoreFailed';

export interface SessionState {
  status: SessionStatus;
  user: MeResponse | null;
}

/** Refresh this long before the access token expires (clock skew, slow networks). */
export const ACCESS_TOKEN_SKEW_MS = 30_000;

export interface SessionDeps {
  api: ApiClient;
  storage: SessionStorage;
  store: StoreApi<SessionState>;
  now?: () => number;
  onStorageError?: (error: unknown) => void;
}

export function createSessionManager({ api, storage, store, now = Date.now, onStorageError }: SessionDeps) {
  const signOutHooks: (() => Promise<void>)[] = [];
  let access: { token: string; expiresAt: number } | null = null;
  let refreshToken: string | null = null;
  let inflight: Promise<string | null> | null = null;

  async function apply(response: AuthSessionResponse): Promise<void> {
    access = { token: response.tokens.accessToken, expiresAt: Date.parse(response.tokens.accessTokenExpiresAt) };
    refreshToken = response.tokens.refreshToken;
    try {
      await storage.save({ refreshToken });
    } catch (error) {
      // The session still works for this run; the user will have to sign in again after a restart.
      onStorageError?.(error);
    }
    store.setState({ status: 'signedIn', user: response.user });
  }

  async function clearLocal(): Promise<void> {
    access = null;
    refreshToken = null;
    try {
      await storage.clear();
    } catch (error) {
      onStorageError?.(error);
    }
    store.setState({ status: 'signedOut', user: null });
  }

  async function doRefresh(): Promise<string | null> {
    const token = refreshToken;
    if (!token) return null;
    try {
      const response = await api.post<AuthSessionResponse>('/auth/refresh', { refreshToken: token }, { auth: false });
      await apply(response);
      return response.tokens.accessToken;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await clearLocal();
        return null;
      }
      throw error; // network / server trouble: keep the session, let the caller show the error
    }
  }

  function refresh(): Promise<string | null> {
    if (!inflight) {
      const p = doRefresh();
      inflight = p;
      p.finally(() => {
        if (inflight === p) inflight = null;
      }).catch(() => undefined);
    }
    return inflight;
  }

  const manager = {
    async getAccessToken(): Promise<string | null> {
      if (access && access.expiresAt - now() > ACCESS_TOKEN_SKEW_MS) return access.token;
      return refreshToken ? refresh() : null;
    },
    refreshAccessToken: refresh,

    signIn: apply,

    /** Run `hook` (still signed in) whenever the user signs out. */
    addSignOutHook(hook: () => Promise<void>): void {
      signOutHooks.push(hook);
    },

    /** Update the cached user (e.g. after verifying the email). */
    setUser(user: MeResponse): void {
      store.setState({ user });
    },

    async signOut(): Promise<void> {
      // Hooks that still need the signed-in API (e.g. remove this device's push token). Max 3 s.
      if (signOutHooks.length) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          Promise.allSettled(signOutHooks.map((hook) => hook())),
          new Promise((resolve) => {
            timer = setTimeout(resolve, 3000);
          }),
        ]);
        clearTimeout(timer);
      }
      const token = refreshToken;
      await clearLocal();
      if (token) {
        // Best effort: revoke on the server. Signing out locally must never wait for or depend on the network.
        api.post('/auth/logout', { refreshToken: token }, { auth: false }).catch(() => undefined);
      }
    },

    /** App start: try to resume the previous session. */
    async restore(): Promise<void> {
      store.setState({ status: 'restoring' });
      let saved = null;
      try {
        saved = await storage.load();
      } catch (error) {
        onStorageError?.(error);
      }
      if (!saved) {
        await clearLocal();
        return;
      }
      refreshToken = saved.refreshToken;
      try {
        await refresh(); // success → signedIn; rejected → signedOut
      } catch {
        store.setState({ status: 'restoreFailed' }); // offline / server asleep: offer "Try again"
      }
    },
  };
  return manager;
}

export type SessionManager = ReturnType<typeof createSessionManager>;

export const useSession: UseBoundStore<StoreApi<SessionState>> = create<SessionState>(() => ({
  status: 'restoring',
  user: null,
}));

/** The app-wide session, wired to the app-wide API client. */
export const session = createSessionManager({
  api: defaultApi,
  storage: secureSessionStorage,
  store: useSession,
  onStorageError: (error) => console.warn('Secure storage error', error),
});
defaultApi.setAuthProvider(session);
