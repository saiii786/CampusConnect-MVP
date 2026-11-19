import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pgOptions } from './pg-options.js';

const PEM = '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n';

describe('pgOptions (database TLS, ADR-031)', () => {
  it('without a CA: passes the URL through unchanged (local Docker)', () => {
    const url = 'postgresql://cc:pw@localhost:5433/campusconnect';
    expect(pgOptions(url)).toEqual({ connectionString: url });
  });

  it('with a CA: verifies the certificate and drops sslmode, which would override the ssl option', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cc-ca-'));
    const ca = join(dir, 'ca.crt');
    writeFileSync(ca, PEM);
    const opts = pgOptions('postgresql://u:p%40ss@db.example.co:6543/postgres?sslmode=no-verify&application_name=api', ca);
    expect(opts.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
    expect(opts.connectionString).not.toContain('sslmode');
    expect(opts.connectionString).toContain('application_name=api');
    expect(opts.connectionString).toContain('p%40ss'); // password encoding kept
  });
});
