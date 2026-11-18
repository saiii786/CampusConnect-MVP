import { PasswordHasher } from './password-hasher.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('uses argon2id with OWASP parameters (m=19 MiB, t=2, p=1)', async () => {
    const hash = await hasher.hash('correct horse battery');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it('verifies the right password and rejects the wrong one', async () => {
    const hash = await hasher.hash('correct horse battery');
    expect(await hasher.verify(hash, 'correct horse battery')).toBe(true);
    expect(await hasher.verify(hash, 'Correct horse battery')).toBe(false);
  });

  it('salts every hash (same password → different hashes)', async () => {
    expect(await hasher.hash('same')).not.toBe(await hasher.hash('same'));
  });

  it('returns false (never throws) for malformed hashes, and the dummy check is always false', async () => {
    expect(await hasher.verify('not-a-hash', 'x')).toBe(false);
    expect(await hasher.verifyDummy('anything')).toBe(false);
  });
});
