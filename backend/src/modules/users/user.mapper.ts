/**
 * Safe response mappers for users. Database rows are NEVER returned directly (they contain
 * passwordHash, dateOfBirth, status, studentEmail…); every response goes through a function here.
 */
import {
  UserBadge,
  type MeResponse,
  type PortfolioItemDto,
  type PublicProfile,
} from '@cc/shared';
import type { PortfolioItem, Prisma } from '../../generated/prisma/client.js';

/** What to load from the database to build a MeResponse. Use with `include`. */
export const ME_INCLUDE = { profile: true, studentVerification: true } as const satisfies Prisma.UserInclude;
export type UserForMe = Prisma.UserGetPayload<{ include: typeof ME_INCLUDE }>;

/** The signed-in user's own account. Only ever sent to that same user. */
export function toMeResponse(user: UserForMe): MeResponse {
  const p = user.profile;
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    profile: {
      displayName: p?.displayName ?? '',
      avatarUrl: p?.avatarUrl ?? null,
      bio: p?.bio ?? null,
      city: p?.city ?? null,
      collegeName: p?.collegeName ?? null,
      skills: p?.skills ?? [],
      languages: p?.languages ?? [],
    },
    student: {
      verified: p?.studentVerifiedAt != null,
      collegeEmail: p?.studentVerifiedAt ? (p.studentEmail ?? null) : null,
      pendingEmail: user.studentVerification?.collegeEmail ?? null,
    },
  };
}

export function toPortfolioItemDto(item: PortfolioItem): PortfolioItemDto {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    imageUrl: item.imageUrl,
    position: item.position,
  };
}

export const PUBLIC_PROFILE_INCLUDE = {
  profile: true,
  portfolioItems: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
} as const satisfies Prisma.UserInclude;
export type UserForPublicProfile = Prisma.UserGetPayload<{ include: typeof PUBLIC_PROFILE_INCLUDE }>;

/** Another user's profile. NEVER includes email, phone, date of birth, college email or coordinates (FR-054). */
export function toPublicProfile(
  user: UserForPublicProfile,
  stats: { ratingAverage: number | null; ratingCount: number; completedJobs: number },
): PublicProfile {
  const p = user.profile;
  const badges: UserBadge[] = [];
  if (p?.studentVerifiedAt) badges.push(UserBadge.STUDENT);
  if (user.emailVerifiedAt) badges.push(UserBadge.EMAIL_VERIFIED);
  return {
    id: user.id,
    displayName: p?.displayName ?? '',
    avatarUrl: p?.avatarUrl ?? null,
    bio: p?.bio ?? null,
    city: p?.city ?? null,
    collegeName: p?.collegeName ?? null,
    skills: p?.skills ?? [],
    languages: p?.languages ?? [],
    badges,
    memberSince: user.createdAt.toISOString(),
    rating: {
      average: stats.ratingAverage === null ? null : Math.round(stats.ratingAverage * 10) / 10,
      count: stats.ratingCount,
    },
    completedJobs: stats.completedJobs,
    portfolio: user.portfolioItems.map(toPortfolioItemDto),
  };
}
