/**
 * Own profile, public profiles and account deletion (FR-009, FR-050, FR-052, FR-054).
 */
import { Injectable } from '@nestjs/common';
import {
  OrderStatus,
  UploadPurpose,
  UserStatus,
  type MeResponse,
  type PublicProfile,
  type UpdateProfileInput,
} from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PasswordHasher } from '../auth/password-hasher.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { ME_INCLUDE, PUBLIC_PROFILE_INCLUDE, toMeResponse, toPublicProfile } from './user.mapper.js';

/** Orders in these states block account deletion (the other party still depends on them). */
const OPEN_ORDER_STATUSES = [
  OrderStatus.REQUESTED,
  OrderStatus.AWAITING_PAYMENT,
  OrderStatus.IN_PROGRESS,
  OrderStatus.SUBMITTED,
  OrderStatus.DISPUTED,
];

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly passwords: PasswordHasher,
  ) {}

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: ME_INCLUDE });
    if (!user) throw AppError.notFound();
    return toMeResponse(user);
  }

  /** PATCH /me — only the given fields change. A new avatar must be an upload the caller owns. */
  async updateMe(userId: string, input: UpdateProfileInput): Promise<MeResponse> {
    const current = await this.prisma.profile.findUnique({ where: { userId }, select: { avatarKey: true } });
    if (!current) throw AppError.notFound();

    let avatar: { avatarUrl: string | null; avatarKey: string | null } | undefined;
    if (input.avatarUploadKey === null) {
      avatar = { avatarUrl: null, avatarKey: null };
    } else if (input.avatarUploadKey !== undefined && input.avatarUploadKey !== current.avatarKey) {
      const claimed = await this.uploads.claim(userId, input.avatarUploadKey, UploadPurpose.AVATAR);
      avatar = { avatarUrl: claimed.url, avatarKey: claimed.key };
    }

    await this.prisma.profile.update({
      where: { userId },
      data: {
        displayName: input.displayName,
        bio: input.bio,
        city: input.city,
        collegeName: input.collegeName,
        skills: input.skills,
        languages: input.languages,
        ...avatar,
      },
    });
    if (avatar && current.avatarKey) await this.uploads.discard([current.avatarKey]);
    return this.getMe(userId);
  }

  /** GET /users/:id — 404 for unknown, suspended or deleted users. */
  async getPublicProfile(userId: string): Promise<PublicProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: PUBLIC_PROFILE_INCLUDE });
    if (!user || user.status !== UserStatus.ACTIVE) throw AppError.notFound('USER_NOT_FOUND', 'User not found');

    const [rating, completedJobs] = await Promise.all([
      this.prisma.review.aggregate({ where: { revieweeId: userId, hiddenAt: null }, _avg: { rating: true }, _count: true }),
      this.prisma.order.count({ where: { sellerId: userId, status: OrderStatus.COMPLETED } }),
    ]);
    return toPublicProfile(user, {
      ratingAverage: rating._avg.rating,
      ratingCount: rating._count,
      completedJobs,
    });
  }

  /**
   * DELETE /me (FR-009): re-check the password, refuse while orders are open, then anonymise.
   * Orders and reviews stay (the other party keeps their record) but point to "Deleted user".
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { select: { avatarKey: true } }, portfolioItems: { select: { imageKey: true } } },
    });
    if (!user) throw AppError.notFound();
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw AppError.forbidden('AUTH_PASSWORD_INCORRECT', 'Password is incorrect');
    }
    const openOrders = await this.prisma.order.count({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }], status: { in: OPEN_ORDER_STATUSES } },
    });
    if (openOrders > 0) {
      throw AppError.conflict(
        'ACCOUNT_HAS_OPEN_ORDERS',
        'Finish or cancel your open orders before deleting your account',
        { openOrders },
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted+${userId}@deleted.invalid`,
          passwordHash: '!deleted',
          emailVerifiedAt: null,
          status: UserStatus.DELETED,
          dateOfBirth: new Date('1900-01-01T00:00:00.000Z'),
        },
      }),
      this.prisma.profile.update({
        where: { userId },
        data: {
          displayName: 'Deleted user',
          avatarUrl: null,
          avatarKey: null,
          bio: null,
          city: null,
          lat: null,
          lng: null,
          skills: [],
          languages: [],
          collegeName: null,
          studentVerifiedAt: null,
          studentEmail: null,
        },
      }),
      this.prisma.portfolioItem.deleteMany({ where: { userId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.emailToken.deleteMany({ where: { userId } }),
      this.prisma.studentVerification.deleteMany({ where: { userId } }),
      this.prisma.pushToken.deleteMany({ where: { userId } }),
      this.prisma.listing.updateMany({ where: { ownerId: userId }, data: { status: 'CLOSED' } }),
    ]);
    await this.uploads.discard([user.profile?.avatarKey, ...user.portfolioItems.map((i) => i.imageKey)]);
  }
}
