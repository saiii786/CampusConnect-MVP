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
