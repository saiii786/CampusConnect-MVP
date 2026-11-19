/**
 * Backup + restore check (ROADMAP T10.4, docs/RUNBOOK.md). Supabase's free plan has no downloadable
 * backups, so we take our own:
 *
 *   BACKUP_DATABASE_URL=<session pooler URL> npm run db:backup -w @cc/backend
 *
 * 1. `pg_dump` (custom format, schema `public`, no owners/grants) runs inside the local Postgres 17
 *    Docker container — no Postgres tools needed on the computer. Output: <repo>/backups/*.dump (git-ignored).
 * 2. VERIFY: the dump is restored into a throwaway local database, every table's row count is compared
 *    with the source, and the throwaway database is dropped. Exit code 1 if anything differs.
 *
 * Read-only on the source. The password is passed to the container as PGPASSWORD, never printed.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const source = process.env.BACKUP_DATABASE_URL;
const container = process.env.BACKUP_DOCKER_CONTAINER ?? 'campusconnect-postgres';
const localUser = process.env.BACKUP_LOCAL_USER ?? 'cc';
if (!source) {
  console.error('Set BACKUP_DATABASE_URL (Supabase session pooler URL, port 5432). See docs/RUNBOOK.md.');
  process.exit(1);
}

const url = new URL(source);
const password = decodeURIComponent(url.password);
url.password = '';
const conn = url.toString(); // no password inside the command line

const docker = (args: string[], env: Record<string, string> = {}) =>
  execFileSync('docker', ['exec', ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), container, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
// TLS required for remote databases; a database inside the same container (tests) has no TLS.
const sslmode = ['localhost', '127.0.0.1'].includes(url.hostname) ? 'disable' : 'require';
const remote = (args: string[]) => docker(args, { PGPASSWORD: password, PGSSLMODE: sslmode });

const COUNT_SQL = `select string_agg(format('%s=%s', table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text), ',' order by table_name)
  from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`;
const counts = (out: string) => new Map(out.trim().split(',').filter(Boolean).map((kv) => kv.split('=') as [string, string]));

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const repoRoot = resolve(import.meta.dirname, '../../..');
const outDir = join(repoRoot, 'backups');
mkdirSync(outDir, { recursive: true });
const file = `connect-${stamp}.dump`;
const tmp = `/tmp/${file}`;
const checkDb = `restore_check_${Date.now()}`;

try {
  console.log(`1/3 Dumping ${url.host}${url.pathname} …`);
  const before = counts(remote(['psql', conn, '-At', '-c', COUNT_SQL]));
  remote(['pg_dump', conn, '--format=custom', '--schema=public', '--no-owner', '--no-privileges', '--file', tmp]);
  execFileSync('docker', ['cp', `${container}:${tmp}`, join(outDir, file)]);
  console.log(`    saved backups/${file} (${Math.round(statSync(join(outDir, file)).size / 1024)} KB, ${before.size} tables)`);

  console.log('2/3 Restoring into a throwaway local database …');
  docker(['createdb', '-U', localUser, checkDb]);
  // A --schema dump leaves out CREATE EXTENSION, and a new database already has schema `public`:
  // create pg_trgm (needed by the trigram indexes) and skip the dump's "CREATE SCHEMA public" entry.
  docker(['psql', '-U', localUser, '-d', checkDb, '-q', '-c', 'create extension if not exists pg_trgm schema public']);
  docker(['sh', '-c', `pg_restore -l ${tmp} | grep -v ' SCHEMA - public ' > ${tmp}.list`]);
  docker(['pg_restore', '-U', localUser, '-d', checkDb, '--no-owner', '--no-privileges', '--exit-on-error', '-L', `${tmp}.list`, tmp]);

  console.log('3/3 Comparing row counts …');
  const after = counts(docker(['psql', '-U', localUser, '-d', checkDb, '-At', '-c', COUNT_SQL]));
  const diffs = [...before].filter(([t, n]) => after.get(t) !== n).map(([t, n]) => `${t}: source ${n}, restored ${after.get(t) ?? 'missing'}`);
  const total = [...before.values()].reduce((s, n) => s + Number(n), 0);
  if (diffs.length) {
    console.error(`RESTORE CHECK FAILED:\n  ${diffs.join('\n  ')}`);
    process.exitCode = 1;
  } else {
    console.log(`    OK — ${before.size} tables, ${total} rows, identical after restore`);
  }
} catch (error) {
  const e = error as { stderr?: string; message: string };
  console.error('BACKUP FAILED:', (e.stderr || e.message).replaceAll(password, '***'));
  process.exitCode = 1;
} finally {
  try { docker(['dropdb', '-U', localUser, '--if-exists', checkDb]); } catch { /* best effort */ }
  try { docker(['rm', '-f', tmp, `${tmp}.list`]); } catch { /* best effort */ }
}
