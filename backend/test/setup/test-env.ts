/**
 * Environment for integration tests. Uses a SEPARATE database (never the dev database).
 * Locally: the `campusconnect_test` DB inside the Docker Postgres (npm run db:up).
 * CI: set TEST_DATABASE_URL.
 */
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv, type AppEnv } from '../../src/config/env.js';

/**
 * Uploaded test images go to the OS temp folder, never into the repo. The folder name starts
 * with a dot on purpose, like the default `.uploads` (Express treats dot-folders specially).
 */
export const TEST_STORAGE_DIR = join(tmpdir(), '.campusconnect-test-uploads');

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
    AUTH_RATE_LIMIT_PER_MINUTE: '1000',
    JWT_ACCESS_SECRET: 'test-only-access-secret-0123456789-abcdef',
    CODE_HASH_SECRET: 'test-only-code-secret-0123456789-fedcba',
    PUSH_DRIVER: 'none',
    JOBS_ENABLED: 'false',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: TEST_STORAGE_DIR,
    ...overrides,
  });
}
