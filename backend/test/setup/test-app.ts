/**
 * Boots the real application (same factory as production: same middleware, filters, pipes)
 * against the test database. Use in integration tests:
 *
 *   const app = await createTestApp();
 *   await request(app.getHttpServer()).get('/api/v1/health').expect(200);
 *   await app.close();
 */
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../../src/app.factory.js';
import { testEnv } from './test-env.js';

export async function createTestApp(overrides: Record<string, string> = {}): Promise<INestApplication> {
  const app = await createApp(testEnv(overrides));
  await app.init();
  return app;
}
