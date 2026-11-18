/**
 * Prisma 7 CLI configuration (migrate, generate, seed, studio).
 * Prisma 7 does not load .env automatically, so dotenv is loaded here.
 *
 * Migrations use DIRECT_URL (Supabase's non-pooled connection); the running app uses
 * DATABASE_URL via PrismaService. The URL is only set when present, so `prisma generate`
 * (which needs no database) works on a fresh checkout / in CI; commands that need the
 * database fail with Prisma's own clear error if DIRECT_URL is missing.
 */
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const directUrl = process.env.DIRECT_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...(directUrl ? { datasource: { url: directUrl } } : {}),
});
