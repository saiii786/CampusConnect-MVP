/**
 * Integration tests for the platform layer (Phase 0): health check, standard error shape,
 * request IDs and security headers — running the real app against the test database.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp } from './setup/test-app.js';

describe('Platform (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health reports ok with the database up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('returns unknown routes in the standard error shape with the request id', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
    const requestId = res.headers['x-request-id'];
    expect(requestId).toBeTruthy();
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: expect.any(String),
        details: null,
        requestId,
      },
    });
  });

  it('echoes a safe incoming x-request-id and replaces an unsafe one', async () => {
    const safe = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', 'client-req-12345');
    expect(safe.headers['x-request-id']).toBe('client-req-12345');

    // (Line breaks can't even be sent — Node's HTTP client rejects them — so test values that
    //  are legal HTTP but unsafe to copy into logs: markup, and an oversized value.)
    for (const bad of ['<script>alert(1)</script>', 'a'.repeat(500)]) {
      const unsafe = await request(app.getHttpServer()).get('/api/v1/health').set('x-request-id', bad);
      expect(unsafe.headers['x-request-id']).not.toBe(bad);
      expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('sends security headers (helmet) and hides the framework', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('rejects oversized JSON bodies with the standard error shape', async () => {
    const big = { data: 'x'.repeat(200 * 1024) };
    const res = await request(app.getHttpServer()).post('/api/v1/health').send(big);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
