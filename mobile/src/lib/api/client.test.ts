import { ApiError } from './api-error';
import { createApiClient } from './client';

const BASE = 'http://test.local/api/v1';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api client', () => {
  it('sends JSON to base URL + path and returns parsed data', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const api = createApiClient(() => BASE, fetchImpl);

    await expect(api.post('/things', { a: 1 })).resolves.toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${BASE}/things`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('turns the standard error body into an ApiError with code, details and request id', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Some fields are missing or invalid',
          details: [{ path: 'email', message: 'Invalid email' }],
          requestId: 'rid-9',
        },
      }),
    );
    const api = createApiClient(() => BASE, fetchImpl);

    const error = await api.get('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      requestId: 'rid-9',
      details: [{ path: 'email', message: 'Invalid email' }],
    });
  });

  it('reports unreachable servers as NETWORK_ERROR', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const api = createApiClient(() => BASE, fetchImpl);
    await expect(api.get('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('reports slow servers as TIMEOUT', async () => {
    const fetchImpl = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const api = createApiClient(() => BASE, fetchImpl as unknown as typeof fetch);
    await expect(api.get('/slow', { timeoutMs: 20 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('handles non-JSON error pages (e.g. a proxy error) without crashing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }));
    const api = createApiClient(() => BASE, fetchImpl);
    await expect(api.get('/x')).rejects.toMatchObject({ status: 502, code: 'UNEXPECTED_RESPONSE' });
  });
});

describe('api client with auth', () => {
  const tokenInvalid = () =>
    jsonResponse(401, { error: { code: 'AUTH_TOKEN_INVALID', message: 'x', details: null, requestId: null } });

  function provider(token: string | null, refreshed: string | null = 'fresh') {
    return {
      getAccessToken: jest.fn(async () => token),
      refreshAccessToken: jest.fn(async () => refreshed),
    };
  }

  it('attaches the bearer token, but not for auth: false requests', async () => {
    const fetchImpl = jest.fn().mockImplementation(async () => jsonResponse(200, {}));
    const api = createApiClient(() => BASE, fetchImpl);
    api.setAuthProvider(provider('tok'));

    await api.get('/me');
    await api.post('/auth/login', {}, { auth: false });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });

  it('on 401 AUTH_TOKEN_INVALID refreshes once and retries with the new token', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(tokenInvalid())
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const api = createApiClient(() => BASE, fetchImpl);
    const auth = provider('old');
    api.setAuthProvider(auth);

    await expect(api.get('/me')).resolves.toEqual({ ok: true });
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
  });

  it('does not loop: a second 401 is returned to the caller', async () => {
    const fetchImpl = jest.fn().mockImplementation(async () => tokenInvalid());
    const api = createApiClient(() => BASE, fetchImpl);
    api.setAuthProvider(provider('old'));
    await expect(api.get('/me')).rejects.toMatchObject({ status: 401, code: 'AUTH_TOKEN_INVALID' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not refresh for other errors (e.g. wrong password, suspended)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(403, { error: { code: 'AUTH_ACCOUNT_SUSPENDED', message: 'x', details: null, requestId: null } }),
    );
    const api = createApiClient(() => BASE, fetchImpl);
    const auth = provider('tok');
    api.setAuthProvider(auth);
    await expect(api.get('/me')).rejects.toMatchObject({ code: 'AUTH_ACCOUNT_SUSPENDED' });
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
  });
});
