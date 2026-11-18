/**
 * Global authentication + authorisation guard (T1.5, FR-601). Registered as APP_GUARD in
 * app.module.ts, so EVERY route requires a valid access token unless marked @Public().
 *
 * Per request:
 *   1. `Authorization: Bearer <token>` → verify signature/expiry (TokenService)   else 401
 *   2. Load the user's CURRENT role/status from the database:
 *        missing or DELETED → 401 AUTH_TOKEN_INVALID
 *        SUSPENDED          → 403 AUTH_ACCOUNT_SUSPENDED (takes effect immediately)
 *   3. @Roles(...)             → 403 FORBIDDEN if the role is not listed
 *   4. @RequireVerifiedEmail() → 403 AUTH_EMAIL_NOT_VERIFIED
 *   5. Attach { id, role, emailVerified } as request.user (read with @CurrentUser()).
 *
 * The extra indexed primary-key lookup per request is the price of instant suspension.
 * WebSocket connections are authenticated separately in the realtime gateway (Phase 4).
 */
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatus, type UserRole } from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  IS_PUBLIC_KEY,
  REQUIRE_VERIFIED_EMAIL_KEY,
  ROLES_KEY,
  type RequestWithUser,
} from './auth.decorators.js';
import { TokenService } from './token.service.js';

interface HttpRequestLike extends RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    const token = readBearerToken(request.headers.authorization);
    if (!token) throw AppError.unauthorized('AUTH_REQUIRED', 'You need to sign in');

    const { userId } = await this.tokens.verifyAccessToken(token);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, emailVerifiedAt: true },
    });
    if (!user || user.status === UserStatus.DELETED) {
      throw AppError.unauthorized('AUTH_TOKEN_INVALID', 'Your session is not valid. Please sign in again.');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw AppError.forbidden('AUTH_ACCOUNT_SUSPENDED', 'Your account is suspended. Contact support.');
    }

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, targets);
    if (roles && roles.length > 0 && !roles.includes(user.role)) throw AppError.forbidden();

    const emailVerified = user.emailVerifiedAt !== null;
    if (this.reflector.getAllAndOverride<boolean>(REQUIRE_VERIFIED_EMAIL_KEY, targets) && !emailVerified) {
      throw AppError.forbidden('AUTH_EMAIL_NOT_VERIFIED', 'Please verify your email first');
    }

    request.user = { id: user.id, role: user.role, emailVerified };
    return true;
  }
}

/** Extract the token from "Bearer <token>" (case-insensitive scheme). Null if absent/malformed. */
export function readBearerToken(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+([A-Za-z0-9._~+/=-]+)\s*$/i.exec(header);
  return match ? match[1]! : null;
}
