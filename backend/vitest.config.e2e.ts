import { defineConfig } from 'vitest/config';

/**
 * Integration (API) tests against a real PostgreSQL test database.
 * Files: test/**\/*.e2e-spec.ts. Setup: test/setup/global-setup.ts (env + migrations).
 * Run sequentially because suites share one database.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
