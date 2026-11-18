/**
 * Environment for integration tests. Uses a SEPARATE database (never the dev database).
 * Locally: the `campusconnect_test` DB inside the Docker Postgres (npm run db:up).
 * CI: set TEST_DATABASE_URL.
 */
import { loadEnv, type AppEnv } from '../../src/config/env.js';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://cc:cc_local_dev_only@localhost:5433/campusconnect_test';

export function testEnv(overrides: Record<string, string> = {}): AppEnv {
  return loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    DIRECT_URL: TEST_DATABASE_URL,
    LOG_LEVEL: 'error',
    RATE_LIMIT_PER_MINUTE: '1000',
    ...overrides,
  });
}
