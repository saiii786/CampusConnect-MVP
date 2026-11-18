import { SignJWT, UnsecuredJWT } from 'jose';
import { loadEnv } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { hashRefreshToken, JWT_AUDIENCE, JWT_ISSUER, TokenService } from './token.service.js';

const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  DIRECT_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'unit-test-access-secret-0123456789abcdef',
  CODE_HASH_SECRET: 'unit-test-code-secret-0123456789abcdef',
});
const USER_ID = '01936b6e-7c3a-7d4e-8f00-0123456789ab';
const key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

async function expectInvalid(promise: Promise<unknown>) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ code: 'AUTH_TOKEN_INVALID', status: 401 });
}

describe('TokenService', () => {
  const tokens = new TokenService(env);

  it('signs an access token that verifies back to the user id, expiring after the TTL', async () => {
    const now = new Date();
    const { token, expiresAt } = await tokens.signAccessToken(USER_ID, now);
    // expiresAt is used to close sockets when their token expires (Phase 9).
    expect(await tokens.verifyAccessToken(token)).toEqual({ userId: USER_ID, expiresAt });
    const ttlSeconds = (expiresAt.getTime() - Math.floor(now.getTime() / 1000) * 1000) / 1000;
    expect(ttlSeconds).toBe(15 * 60);
  });

  it('rejects an expired token', async () => {
    const { token } = await tokens.signAccessToken(USER_ID, new Date(Date.now() - 60 * 60 * 1000));
    await expectInvalid(tokens.verifyAccessToken(token));
  });

  it('rejects a token signed with a different secret', async () => {
    const other = new TokenService({ ...env, JWT_ACCESS_SECRET: 'some-other-secret-that-is-long-enough!!' });
    const { token } = await other.signAccessToken(USER_ID);
    await expectInvalid(tokens.verifyAccessToken(token));
  });

  it('rejects unsigned (alg: none) tokens — the old CampusConnect socket bug', async () => {
    const token = new UnsecuredJWT({ typ: 'access' })
      .setSubject(USER_ID)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .encode();
    await expectInvalid(tokens.verifyAccessToken(token));
  });

  it('rejects tokens with the wrong type, audience or a non-uuid subject', async () => {
    const make = (claims: Record<string, unknown>, sub: string, aud = JWT_AUDIENCE) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(sub)
        .setIssuer(JWT_ISSUER)
        .setAudience(aud)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(key);
    await expectInvalid(tokens.verifyAccessToken(await make({ typ: 'refresh' }, USER_ID)));
    await expectInvalid(tokens.verifyAccessToken(await make({ typ: 'access' }, USER_ID, 'someone-else')));
    await expectInvalid(tokens.verifyAccessToken(await make({ typ: 'access' }, 'admin')));
    await expectInvalid(tokens.verifyAccessToken('not.a.jwt'));
  });

  it('creates unguessable refresh tokens and stores only a hash', () => {
    const a = tokens.newRefreshToken();
    const b = tokens.newRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 random bytes
    expect(a.hash).toBe(hashRefreshToken(a.token));
    expect(a.hash).not.toContain(a.token);
    const days = (a.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });
});
