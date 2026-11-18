/**
 * Safe response mappers for users. Database rows are NEVER returned directly (they contain
 * passwordHash, dateOfBirth, status…); every response goes through a function here.
 */
import type { MeResponse } from '@cc/shared';
import type { Profile, User } from '../../generated/prisma/client.js';

export type UserWithProfile = User & { profile: Profile | null };

/** The signed-in user's own account. Only ever sent to that same user. */
export function toMeResponse(user: UserWithProfile): MeResponse {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    role: user.role,
    displayName: user.profile?.displayName ?? '',
    createdAt: user.createdAt.toISOString(),
  };
}
