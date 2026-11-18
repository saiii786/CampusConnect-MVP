/**
 * Integration tests for accounts and sessions (Phase 1: FR-001…006, FR-601, FR-603) — the real
 * app against the real test database. Verification codes are read from the console mail driver.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { AuthSessionResponse } from '@cc/shared';
import { ConsoleMailService, MailService } from '../src/modules/mail/mail.service.js';
import { TokenService } from '../src/modules/auth/token.service.js';
import { CODE_MAX_PER_DAY } from '../src/modules/auth/code-hasher.js';
import { EMAIL_CODE_MAX_ATTEMPTS } from '../src/modules/auth/email-code.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetUserData } from './setup/db.js';
import { createTestApp } from './setup/test-app.js';

const PASSWORD = 'correct horse battery';

let app: INestApplication<App>;
let prisma: PrismaService;
let mail: ConsoleMailService;
let counter = 0;

const api = () => request(app.getHttpServer());
const uniqueEmail = () => `user${++counter}.${Date.now()}@example.com`;

function signupBody(email: string, overrides: Record<string, unknown> = {}) {
  return { email, password: PASSWORD, displayName: 'Test User', dateOfBirth: '2000-01-15', acceptTerms: true, ...overrides };
}

async function signup(email = uniqueEmail()): Promise<AuthSessionResponse & { email: string }> {
  const res = await api().post('/api/v1/auth/signup').send(signupBody(email)).expect(201);
  return { ...(res.body as AuthSessionResponse), email };
}

/** The 6-digit code in the latest email sent to `email`. */
function lastCode(email: string): string {
  const message = mail.lastTo(email);
  const code = message?.subject.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`no code emailed to ${email}`);
  return code;
}

/** Make the latest code for this user old enough to bypass the resend cooldown. */
async function expireCooldown(userId: string) {
  await prisma.emailToken.updateMany({ where: { userId }, data: { createdAt: new Date(Date.now() - 5 * 60_000) } });
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);
  mail = app.get(MailService) as ConsoleMailService;
  await resetUserData(app);
});

afterAll(async () => {
  await resetUserData(app);
  await app.close();
});

describe('signup (FR-001, FR-005)', () => {
  it('creates the account, profile and empty wallet, signs in and emails a code', async () => {
    const email = uniqueEmail();
    const res = await api().post('/api/v1/auth/signup').send(signupBody(email.toUpperCase())).expect(201);
    const body = res.body as AuthSessionResponse;

    expect(body.user).toMatchObject({
      email,
      emailVerified: false,
      role: 'USER',
      profile: { displayName: 'Test User', skills: [], avatarUrl: null },
      student: { verified: false, collegeEmail: null, pendingEmail: null },
    });
    expect(body.tokens.accessToken).toBeTruthy();
    expect(body.tokens.refreshToken).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|dateOfBirth|argon2/);

    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { profile: true, wallet: true } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.profile?.displayName).toBe('Test User');
    expect(user.wallet?.balancePaise).toBe(0);
    expect(user.termsAcceptedAt).toBeInstanceOf(Date);
    expect(lastCode(email)).toMatch(/^\d{6}$/);
  });

  it('rejects a duplicate email regardless of case', async () => {
    const { email } = await signup();
    const res = await api().post('/api/v1/auth/signup').send(signupBody(email.toUpperCase())).expect(409);
    expect(res.body.error.code).toBe('AUTH_EMAIL_TAKEN');
  });

  it('rejects under-18, missing terms and extra fields such as role', async () => {
    const thisYear = new Date().getUTCFullYear();
    for (const bad of [
      { dateOfBirth: `${thisYear - 17}-01-01` },
      { acceptTerms: false },
      { role: 'ADMIN' },
      { password: 'short' },
    ]) {
      const res = await api().post('/api/v1/auth/signup').send(signupBody(uniqueEmail(), bad)).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    }
  });
});

describe('login (FR-001)', () => {
  it('signs in with the right password (email case-insensitive)', async () => {
    const { email } = await signup();
    const res = await api().post('/api/v1/auth/login').send({ email: email.toUpperCase(), password: PASSWORD }).expect(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.tokens.accessToken).toBeTruthy();
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const { email } = await signup();
    const wrong = await api().post('/api/v1/auth/login').send({ email, password: 'wrong password' }).expect(401);
    const unknown = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD })
      .expect(401);
    expect(wrong.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(unknown.body.error).toMatchObject({ code: wrong.body.error.code, message: wrong.body.error.message });
  });
});

describe('access tokens and GET /me (T1.5)', () => {
  it('returns the signed-in user with a valid token', async () => {
    const s = await signup();
    const res = await api().get('/api/v1/me').set(bearer(s.tokens.accessToken)).expect(200);
    expect(res.body).toMatchObject({ id: s.user.id, email: s.email, emailVerified: false });
  });

  it('rejects missing, malformed, forged and expired tokens', async () => {
    const s = await signup();
    expect((await api().get('/api/v1/me').expect(401)).body.error.code).toBe('AUTH_REQUIRED');
    expect((await api().get('/api/v1/me').set(bearer('garbage')).expect(401)).body.error.code).toBe(
      'AUTH_TOKEN_INVALID',
    );

    const forger = new TokenService({ ...app.get(TokenService)['env'], JWT_ACCESS_SECRET: 'x'.repeat(40) });
    const forged = await forger.signAccessToken(s.user.id);
    await api().get('/api/v1/me').set(bearer(forged.token)).expect(401);

    const expired = await app.get(TokenService).signAccessToken(s.user.id, new Date(Date.now() - 60 * 60_000));
    await api().get('/api/v1/me').set(bearer(expired.token)).expect(401);
  });
});

describe('refresh rotation and reuse detection (FR-002)', () => {
  it('rotates: returns new tokens and the old refresh token stops working', async () => {
    const s = await signup();
    const res = await api().post('/api/v1/auth/refresh').send({ refreshToken: s.tokens.refreshToken }).expect(200);
    const next = res.body as AuthSessionResponse;
    expect(next.tokens.refreshToken).not.toBe(s.tokens.refreshToken);
    expect(next.user.id).toBe(s.user.id);
    await api().get('/api/v1/me').set(bearer(next.tokens.accessToken)).expect(200);
  });

  it('reusing an old refresh token revokes the whole session family', async () => {
    const s = await signup();
    const r1 = await api().post('/api/v1/auth/refresh').send({ refreshToken: s.tokens.refreshToken }).expect(200);
    const legit = (r1.body as AuthSessionResponse).tokens.refreshToken;

    // Attacker replays the stolen original token.
    const replay = await api().post('/api/v1/auth/refresh').send({ refreshToken: s.tokens.refreshToken }).expect(401);
    expect(replay.body.error.code).toBe('AUTH_REFRESH_REUSED');

    // The legitimate newer token is now revoked too.
    const after = await api().post('/api/v1/auth/refresh').send({ refreshToken: legit }).expect(401);
    expect(after.body.error.code).toBe('AUTH_REFRESH_REUSED');
  });

  it('only one of two concurrent refreshes with the same token succeeds', async () => {
    const s = await signup();
    const results = await Promise.all([
      api().post('/api/v1/auth/refresh').send({ refreshToken: s.tokens.refreshToken }),
      api().post('/api/v1/auth/refresh').send({ refreshToken: s.tokens.refreshToken }),
    ]);
    expect(results.filter((r) => r.status === 200).length).toBeLessThanOrEqual(1);
    expect(results.some((r) => r.status === 401)).toBe(true);
  });

  it('rejects unknown and expired refresh tokens', async () => {
    const unknown = await api().post('/api/v1/auth/refresh').send({ refreshToken: 'x'.repeat(43) }).expect(401);
    expect(unknown.body.error.code).toBe('AUTH_REFRESH_INVALID');

    const s = await signup();
    await prisma.refreshToken.updateMany({ where: { userId: s.user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await api().post('/api/v1/auth/refresh').send({ refreshToken: s.tokens.refreshToken }).expect(401);
    expect(expired.body.error.code).toBe('AUTH_REFRESH_INVALID');
  });

  it('logout revokes the session; other devices stay signed in', async () => {
    const s = await signup();
    const other = await api().post('/api/v1/auth/login').send({ email: s.email, password: PASSWORD }).expect(200);

    await api().post('/api/v1/auth/logout').send({ refreshToken: s.tokens.refreshToken }).expect(204);
    await api().post('/api/v1/auth/logout').send({ refreshToken: s.tokens.refreshToken }).expect(204); // idempotent
    await api().post('/api/v1/auth/refresh').send({ refreshToken: s.tokens.refreshToken }).expect(401);
    await api().post('/api/v1/auth/refresh').send({ refreshToken: other.body.tokens.refreshToken }).expect(200);
  });
});

describe('email verification (FR-003)', () => {
  it('wrong code → attempts left; right code → verified; again → 409', async () => {
    const s = await signup();
    const code = lastCode(s.email);
    const wrong = code === '000000' ? '111111' : '000000';

    const bad = await api().post('/api/v1/auth/verify-email').set(bearer(s.tokens.accessToken)).send({ code: wrong }).expect(400);
    expect(bad.body.error).toMatchObject({ code: 'AUTH_CODE_INVALID', details: { attemptsLeft: 4 } });

    const ok = await api().post('/api/v1/auth/verify-email').set(bearer(s.tokens.accessToken)).send({ code }).expect(200);
    expect(ok.body.emailVerified).toBe(true);

    const again = await api().post('/api/v1/auth/verify-email').set(bearer(s.tokens.accessToken)).send({ code }).expect(409);
    expect(again.body.error.code).toBe('AUTH_EMAIL_ALREADY_VERIFIED');
  });

  it('a code dies after 5 wrong attempts, even if the right code is sent afterwards', async () => {
    const s = await signup();
    const code = lastCode(s.email);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await api().post('/api/v1/auth/verify-email').set(bearer(s.tokens.accessToken)).send({ code: wrong }).expect(400);
    }
    const res = await api().post('/api/v1/auth/verify-email').set(bearer(s.tokens.accessToken)).send({ code }).expect(400);
    expect(res.body.error.code).toBe('AUTH_CODE_EXPIRED');
  });

  it('resend has a cooldown, then replaces the old code', async () => {
    const s = await signup();
    const first = lastCode(s.email);
    const cool = await api().post('/api/v1/auth/resend-verification').set(bearer(s.tokens.accessToken)).expect(429);
    expect(cool.body.error.code).toBe('AUTH_CODE_COOLDOWN');

    await expireCooldown(s.user.id);
    await api().post('/api/v1/auth/resend-verification').set(bearer(s.tokens.accessToken)).expect(202);
    const second = lastCode(s.email);
    if (first !== second) {
      await api().post('/api/v1/auth/verify-email').set(bearer(s.tokens.accessToken)).send({ code: first }).expect(400);
    }
    await api().post('/api/v1/auth/verify-email').set(bearer(s.tokens.accessToken)).send({ code: second }).expect(200);
  });

  it('expired codes are refused', async () => {
    const s = await signup();
    await prisma.emailToken.updateMany({ where: { userId: s.user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await api()
      .post('/api/v1/auth/verify-email')
      .set(bearer(s.tokens.accessToken))
      .send({ code: lastCode(s.email) })
      .expect(400);
    expect(res.body.error.code).toBe('AUTH_CODE_EXPIRED');
  });
});

describe('password reset (FR-006)', () => {
  it('unknown email → 202 and nothing is sent (no account enumeration)', async () => {
    const before = mail.outbox.length;
    await api().post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.com' }).expect(202);
    expect(mail.outbox.length).toBe(before);
  });

  it('resets the password with the code, signs out all devices and verifies the email', async () => {
    const s = await signup();
    await expireCooldown(s.user.id);
    await api().post('/api/v1/auth/forgot-password').send({ email: s.email }).expect(202);
    const code = lastCode(s.email);
    expect(mail.lastTo(s.email)?.subject).toContain('password reset');

    const wrong = code === '000000' ? '111111' : '000000';
    await api()
      .post('/api/v1/auth/reset-password')
      .send({ email: s.email, code: wrong, newPassword: 'a brand new password' })
      .expect(400);
    await api()
      .post('/api/v1/auth/reset-password')
      .send({ email: s.email, code, newPassword: 'a brand new password' })
      .expect(204);

    await api().post('/api/v1/auth/refresh').send({ refreshToken: s.tokens.refreshToken }).expect(401);
    await api().post('/api/v1/auth/login').send({ email: s.email, password: PASSWORD }).expect(401);
    const login = await api().post('/api/v1/auth/login').send({ email: s.email, password: 'a brand new password' }).expect(200);
    expect(login.body.user.emailVerified).toBe(true);

    // The code is single-use.
    await api()
      .post('/api/v1/auth/reset-password')
      .send({ email: s.email, code, newPassword: 'yet another password' })
      .expect(400);
  });

  // Phase 9 security review: guesses sent in parallel used to all be checked before the counter moved.
  it('parallel wrong guesses cannot exceed the attempt limit', async () => {
    const s = await signup();
    await expireCooldown(s.user.id);
    await api().post('/api/v1/auth/forgot-password').send({ email: s.email }).expect(202);
    const code = lastCode(s.email);
    const guesses = Array.from({ length: 12 }, (_, i) => String(100000 + i)).filter((g) => g !== code);
    const results = await Promise.all(
      guesses.map((g) => api().post('/api/v1/auth/reset-password').send({ email: s.email, code: g, newPassword: 'a brand new password' })),
    );
    // 5 tries per code: the first 4 wrong ones say "invalid", every other one "expired" — none got through.
    expect(results.filter((r) => r.body.error?.code === 'AUTH_CODE_INVALID')).toHaveLength(EMAIL_CODE_MAX_ATTEMPTS - 1);
    expect(results.every((r) => r.status === 400)).toBe(true);
    // The real code is dead too: a new one must be requested.
    const res = await api().post('/api/v1/auth/reset-password').send({ email: s.email, code, newPassword: 'a brand new password' }).expect(400);
    expect(res.body.error.code).toBe('AUTH_CODE_EXPIRED');
  });

  it('caps codes per day (CODE_MAX_PER_DAY) so guesses cannot be renewed forever', async () => {
    const s = await signup(); // sends verification code #1
    for (let i = 1; i < CODE_MAX_PER_DAY; i++) {
      await expireCooldown(s.user.id);
      await api().post('/api/v1/auth/resend-verification').set(bearer(s.tokens.accessToken)).expect(202);
    }
    await expireCooldown(s.user.id);
    const res = await api().post('/api/v1/auth/resend-verification').set(bearer(s.tokens.accessToken)).expect(429);
    expect(res.body.error.message).toContain('today');
    // The latest code still works.
    await api().post('/api/v1/auth/verify-email').set(bearer(s.tokens.accessToken)).send({ code: lastCode(s.email) }).expect(200);
  });

  it('a verification code cannot be used as a reset code', async () => {
    const s = await signup();
    const verifyCode = lastCode(s.email);
    const res = await api()
      .post('/api/v1/auth/reset-password')
      .send({ email: s.email, code: verifyCode, newPassword: 'a brand new password' })
      .expect(400);
    expect(res.body.error.code).toBe('AUTH_CODE_INVALID');
  });
});

describe('suspended users (FR-601)', () => {
  it('are blocked immediately on every path: API calls, login and refresh', async () => {
    const s = await signup();
    await prisma.user.update({ where: { id: s.user.id }, data: { status: 'SUSPENDED' } });

    const me = await api().get('/api/v1/me').set(bearer(s.tokens.accessToken)).expect(403);
    expect(me.body.error.code).toBe('AUTH_ACCOUNT_SUSPENDED');
    const login = await api().post('/api/v1/auth/login').send({ email: s.email, password: PASSWORD }).expect(403);
    expect(login.body.error.code).toBe('AUTH_ACCOUNT_SUSPENDED');
    // Wrong password does not reveal the suspension.
    await api().post('/api/v1/auth/login').send({ email: s.email, password: 'wrong password' }).expect(401);
    await api().post('/api/v1/auth/refresh').send({ refreshToken: s.tokens.refreshToken }).expect(403);
  });
});

describe('auth rate limiting (FR-603)', () => {
  it('limits login attempts per IP with the standard error shape', async () => {
    const limited = await createTestApp({ AUTH_RATE_LIMIT_PER_MINUTE: '3' });
    try {
      const server = limited.getHttpServer();
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        const res = await request(server).post('/api/v1/auth/login').send({ email: 'a@example.com', password: 'x' });
        statuses.push(res.status);
        if (res.status === 429) expect(res.body.error.code).toBe('RATE_LIMITED');
      }
      expect(statuses).toEqual([401, 401, 401, 429]);
      // Non-auth routes are not affected by the auth limit.
      await request(server).get('/api/v1/health').expect(200);
    } finally {
      await limited.close();
    }
  });
});
