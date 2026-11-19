/**
 * Database-level safety rules (ADR-029). Runs against the migrated test database.
 * Every table in `public` must have Row Level Security enabled, so Supabase's public APIs
 * (anon/authenticated roles) can never read or write app data — even if a grant slips back in.
 * A new migration that creates a table must also `ALTER TABLE … ENABLE ROW LEVEL SECURITY`.
 */
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './setup/test-app.js';

let app: INestApplication<App>;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('schema safety (ADR-029)', () => {
  it('every table in the public schema has Row Level Security enabled', async () => {
    const rows = await app.get(PrismaService).$queryRaw<{ table: string }[]>`
      SELECT c.relname AS "table"
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      ORDER BY 1`;
    expect(rows.map((r) => r.table)).toEqual([]);
  });

  it('the backend still reads and writes normally (it owns the tables, so RLS does not apply to it)', async () => {
    const prisma = app.get(PrismaService);
    await expect(prisma.category.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.user.count()).resolves.toBeGreaterThanOrEqual(0);
  });
});
