/**
 * node-postgres connection options for the Prisma driver adapter (ADR-031).
 *
 * With `DATABASE_CA_CERT_PATH` set, the server certificate is VERIFIED against that CA (Supabase signs
 * with its own CA: `backend/certs/supabase-prod-ca-2021.crt`). Any `sslmode` in the URL is removed in
 * that case, because node-postgres lets URL parameters override the `ssl` option.
 * Without it the URL decides (local Docker: no TLS).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaPg } from '@prisma/adapter-pg';

type PgOptions = Extract<ConstructorParameters<typeof PrismaPg>[0], { connectionString?: string }>;

export function pgOptions(databaseUrl: string, caCertPath?: string): PgOptions {
  if (!caCertPath) return { connectionString: databaseUrl };
  const url = new URL(databaseUrl);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('sslrootcert');
  return {
    connectionString: url.toString(),
    ssl: { ca: readFileSync(resolve(caCertPath), 'utf8'), rejectUnauthorized: true },
  };
}
