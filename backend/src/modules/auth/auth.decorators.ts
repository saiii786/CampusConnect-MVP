/**
 * Route decorators for authentication and authorisation (T1.5).
 *
 *   @Public()                 no sign-in needed (everything else requires a valid access token)
 *   @Roles('ADMIN')           only these roles (role is read from the database, not the token)
 *   @RequireVerifiedEmail()   signed in AND email verified (FR-003: posting, ordering)
 *   @AuthRateLimit()          stricter per-IP limit, AUTH_RATE_LIMIT_PER_MINUTE (FR-603)
 *   @CurrentUser() user       inject the signed-in user ({ id, role, emailVerified })
 */
import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';

export const IS_PUBLIC_KEY = 'cc:isPublic';
export const ROLES_KEY = 'cc:roles';
export const REQUIRE_VERIFIED_EMAIL_KEY = 'cc:requireVerifiedEmail';
export const AUTH_RATE_LIMIT_KEY = 'cc:authRateLimit';

/** The signed-in user, attached to the request by AuthGuard. */
export interface AuthUser {
  id: string;
  role: UserRole;
  emailVerified: boolean;
}

export interface RequestWithUser {
  user?: AuthUser;
}

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
export const RequireVerifiedEmail = () => SetMetadata(REQUIRE_VERIFIED_EMAIL_KEY, true);
export const AuthRateLimit = () => SetMetadata(AUTH_RATE_LIMIT_KEY, true);

/** True if the handler is marked @AuthRateLimit() (used by the 'auth' throttler's skipIf). */
export function hasAuthRateLimit(context: ExecutionContext): boolean {
  return Reflect.getMetadata(AUTH_RATE_LIMIT_KEY, context.getHandler()) === true;
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  const user = context.switchToHttp().getRequest<RequestWithUser>().user;
  // Only reachable if a @Public() route asks for the user — a programming error.
  if (!user) throw AppError.unauthorized();
  return user;
});
