/**
 * AuthGuard unit tests with stubbed token verification and database (the integration tests in
 * test/auth.e2e-spec.ts cover the same paths against a real database).
 */
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../../common/errors/app-error.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { Public, RequireVerifiedEmail, Roles, type RequestWithUser } from './auth.decorators.js';
import { AuthGuard, readBearerToken } from './auth.guard.js';
import type { TokenService } from './token.service.js';

const USER_ID = '01936b6e-7c3a-7d4e-8f00-0123456789ab';

class FakeController {
  @Public()
  open() {}
  closed() {}
  @Roles('ADMIN')
  adminOnly() {}
  @RequireVerifiedEmail()
  verifiedOnly() {}
}

type DbUser = { id: string; role: 'USER' | 'ADMIN'; status: 'ACTIVE' | 'SUSPENDED' | 'DELETED'; emailVerifiedAt: Date | null };

function setup(dbUser: DbUser | null) {
  const tokens = {
    verifyAccessToken: vi.fn(async (token: string) => {
      if (token !== 'good') throw AppError.unauthorized('AUTH_TOKEN_INVALID', 'bad');
      return { userId: USER_ID };
    }),
  } as unknown as TokenService;
  const findUnique = vi.fn(async () => dbUser);
  const prisma = { user: { findUnique } } as unknown as PrismaService;
  const guard = new AuthGuard(new Reflector(), tokens, prisma);

  const run = async (handler: keyof FakeController, authorization?: string) => {
    const request: RequestWithUser & { headers: Record<string, string | undefined> } = {
      headers: { authorization },
    };
    const context = {
      getType: () => 'http',
      getHandler: () => FakeController.prototype[handler],
      getClass: () => FakeController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const allowed = await guard.canActivate(context);
    return { allowed, request };
  };
  return { run, findUnique };
}

const active: DbUser = { id: USER_ID, role: 'USER', status: 'ACTIVE', emailVerifiedAt: new Date() };

describe('AuthGuard', () => {
  it('lets @Public() routes through without a token or a database lookup', async () => {
    const { run, findUnique } = setup(null);
    expect((await run('open')).allowed).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('requires a bearer token everywhere else', async () => {
    const { run } = setup(active);
    await expect(run('closed')).rejects.toMatchObject({ code: 'AUTH_REQUIRED', status: 401 });
    await expect(run('closed', 'Basic abc')).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    await expect(run('closed', 'Bearer bad')).rejects.toMatchObject({ code: 'AUTH_TOKEN_INVALID' });
  });

  it('attaches the user for a valid token', async () => {
    const { run } = setup(active);
    const { allowed, request } = await run('closed', 'Bearer good');
    expect(allowed).toBe(true);
    expect(request.user).toEqual({ id: USER_ID, role: 'USER', emailVerified: true });
  });

  it('blocks deleted (401) and suspended (403) users even with a valid token', async () => {
    await expect(setup({ ...active, status: 'DELETED' }).run('closed', 'Bearer good')).rejects.toMatchObject({
      code: 'AUTH_TOKEN_INVALID',
      status: 401,
    });
    await expect(setup(null).run('closed', 'Bearer good')).rejects.toMatchObject({ status: 401 });
    await expect(setup({ ...active, status: 'SUSPENDED' }).run('closed', 'Bearer good')).rejects.toMatchObject({
      code: 'AUTH_ACCOUNT_SUSPENDED',
      status: 403,
    });
  });

  it('enforces @Roles using the role from the database', async () => {
    await expect(setup(active).run('adminOnly', 'Bearer good')).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect((await setup({ ...active, role: 'ADMIN' }).run('adminOnly', 'Bearer good')).allowed).toBe(true);
  });

  it('enforces @RequireVerifiedEmail', async () => {
    await expect(setup({ ...active, emailVerifiedAt: null }).run('verifiedOnly', 'Bearer good')).rejects.toMatchObject({
      code: 'AUTH_EMAIL_NOT_VERIFIED',
      status: 403,
    });
    expect((await setup(active).run('verifiedOnly', 'Bearer good')).allowed).toBe(true);
  });
});

describe('readBearerToken', () => {
  it('extracts the token and rejects malformed headers', () => {
    expect(readBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(readBearerToken('bearer abc')).toBe('abc');
    expect(readBearerToken('Bearer')).toBeNull();
    expect(readBearerToken('Bearer a b')).toBeNull();
    expect(readBearerToken(undefined)).toBeNull();
    expect(readBearerToken(['Bearer a'])).toBeNull();
  });
});
