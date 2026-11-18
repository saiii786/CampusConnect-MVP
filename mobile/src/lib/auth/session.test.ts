import type { AuthSessionResponse } from '@cc/shared';
import { createStore } from 'zustand/vanilla';
import { createApiClient } from '@/lib/api/client';
import { createSessionManager, type SessionState } from './session';
import type { SessionStorage, StoredSession } from './session-storage';

// The module also builds the app-wide session on import; keep native secure storage out of tests.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const NOW = Date.parse('2026-11-18T12:00:00Z');
let counter = 0;

function sessionResponse(minutesValid = 15): AuthSessionResponse {
  counter += 1;
  return {
    user: {
      id: 'u1',
      email: 'a@b.co',
      emailVerified: false,
      role: 'USER',
      createdAt: '',
      profile: { displayName: 'A', avatarUrl: null, bio: null, city: null, collegeName: null, skills: [], languages: [] },
      student: { verified: false, collegeEmail: null, pendingEmail: null },
    },
    tokens: {
      accessToken: `access-${counter}`,
      accessTokenExpiresAt: new Date(NOW + minutesValid * 60_000).toISOString(),
      refreshToken: `refresh-${counter}`,
      refreshTokenExpiresAt: new Date(NOW + 30 * 86_400_000).toISOString(),
    },
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function memoryStorage(initial: StoredSession | null = null) {
  let value = initial;
  const storage: SessionStorage & { value: () => StoredSession | null } = {
    load: jest.fn(async () => value),
    save: jest.fn(async (s: StoredSession) => {
      value = s;
    }),
    clear: jest.fn(async () => {
      value = null;
    }),
    value: () => value,
  };
  return storage;
}

function setup(fetchImpl: jest.Mock, initial: StoredSession | null = null) {
  const api = createApiClient(() => 'http://test/api/v1', fetchImpl);
  const storage = memoryStorage(initial);
  const store = createStore<SessionState>(() => ({ status: 'restoring', user: null }));
  const manager = createSessionManager({ api, storage, store, now: () => NOW });
  api.setAuthProvider(manager);
  return { api, storage, store, manager };
}

describe('session manager', () => {
  it('signIn stores only the refresh token and marks the user signed in', async () => {
    const { manager, storage, store } = setup(jest.fn());
    const response = sessionResponse();
    await manager.signIn(response);
    expect(store.getState()).toEqual({ status: 'signedIn', user: response.user });
    expect(storage.value()).toEqual({ refreshToken: response.tokens.refreshToken });
    await expect(manager.getAccessToken()).resolves.toBe(response.tokens.accessToken);
  });

  it('refreshes when the access token is about to expire', async () => {
    const next = sessionResponse();
    const fetchImpl = jest.fn().mockResolvedValue(json(200, next));
    const { manager, storage } = setup(fetchImpl);
    const first = sessionResponse(0.25); // expires in 15 s (< 30 s skew)
    await manager.signIn(first);

    await expect(manager.getAccessToken()).resolves.toBe(next.tokens.accessToken);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://test/api/v1/auth/refresh');
    expect(JSON.parse(init.body)).toEqual({ refreshToken: first.tokens.refreshToken });
    expect(init.headers.Authorization).toBeUndefined();
    expect(storage.value()).toEqual({ refreshToken: next.tokens.refreshToken });
  });

  it('concurrent callers share ONE refresh request (a second would look like token theft)', async () => {
    let resolve!: (r: Response) => void;
    const fetchImpl = jest.fn(() => new Promise<Response>((r) => (resolve = r)));
    const { manager } = setup(fetchImpl);
    await manager.signIn(sessionResponse(0));

    const calls = [manager.getAccessToken(), manager.getAccessToken(), manager.refreshAccessToken()];
    const next = sessionResponse();
    resolve(json(200, next));
    await expect(Promise.all(calls)).resolves.toEqual(Array(3).fill(next.tokens.accessToken));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('signs out when the server rejects the refresh token', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      json(401, { error: { code: 'AUTH_REFRESH_REUSED', message: 'x', details: null, requestId: null } }),
    );
    const { manager, storage, store } = setup(fetchImpl);
    await manager.signIn(sessionResponse(0));
    await expect(manager.getAccessToken()).resolves.toBeNull();
    expect(store.getState().status).toBe('signedOut');
    expect(storage.value()).toBeNull();
  });

  it('stays signed in when the refresh fails because of the network', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const { manager, storage, store } = setup(fetchImpl);
    const first = sessionResponse(0);
    await manager.signIn(first);
    await expect(manager.getAccessToken()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(store.getState().status).toBe('signedIn');
    expect(storage.value()).toEqual({ refreshToken: first.tokens.refreshToken });
  });

  describe('restore (app start)', () => {
    it('no saved session → signed out, without calling the server', async () => {
      const fetchImpl = jest.fn();
      const { manager, store } = setup(fetchImpl);
      await manager.restore();
      expect(store.getState().status).toBe('signedOut');
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('saved session → refreshed → signed in', async () => {
      const next = sessionResponse();
      const { manager, store } = setup(jest.fn().mockResolvedValue(json(200, next)), { refreshToken: 'saved' });
      await manager.restore();
      expect(store.getState()).toEqual({ status: 'signedIn', user: next.user });
    });

    it('offline → restoreFailed, saved session kept for "Try again"', async () => {
      const { manager, store, storage } = setup(jest.fn().mockRejectedValue(new TypeError('offline')), {
        refreshToken: 'saved',
      });
      await manager.restore();
      expect(store.getState().status).toBe('restoreFailed');
      expect(storage.value()).toEqual({ refreshToken: 'saved' });
    });
  });

  it('signOut forgets the session locally even if the server cannot be reached', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('offline'));
    const { manager, storage, store } = setup(fetchImpl);
    const s = sessionResponse();
    await manager.signIn(s);
    await manager.signOut();
    expect(store.getState()).toEqual({ status: 'signedOut', user: null });
    expect(storage.value()).toBeNull();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://test/api/v1/auth/logout');
    expect(JSON.parse(init.body)).toEqual({ refreshToken: s.tokens.refreshToken });
    await expect(manager.getAccessToken()).resolves.toBeNull();
  });
});
