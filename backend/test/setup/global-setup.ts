/**
 * Runs once before all integration tests: applies every migration to the test database,
 * so tests always run against the current schema.
 */
import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-env.js';

export default function setup(): void {
  if (!/_test\b|test/.test(new URL(TEST_DATABASE_URL).pathname)) {
    // Safety net: refuse to migrate/wipe a database that doesn't look like a test database.
    throw new Error(`Refusing to run integration tests against non-test database: ${new URL(TEST_DATABASE_URL).pathname}`);
  }
  execSync('npx prisma migrate deploy', {
    cwd: new URL('../..', import.meta.url),
    env: { ...process.env, DIRECT_URL: TEST_DATABASE_URL, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
