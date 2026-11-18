import { defineConfig } from 'vitest/config';

/** Unit tests: fast, no database. Files: src/**\/*.spec.ts */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
