/**
 * Reviews (FR-500…502) and the public work record (FR-053).
 *
 * Rules: only participants of a COMPLETED order; once per person per order (DB unique);
 * within REVIEW_WINDOW_DAYS of completion; rating 1–5; the reviewee may reply once.
 * Work record: completed orders where the user was the SELLER — category, month, the buyer's
 * rating and comment. Never names, emails, phones or amounts (privacy, FR-054).
 */
import { Injectable } from '@nestjs/common';
import {
  NotificationType,
  OrderStatus,
  REVIEW_WINDOW_DAYS,
  UserStatus,
  type CreateReviewInput,
  type OrderReviewsDto,
  type Page,
  type PageQuery,
  type ReplyReviewInput,
  type ReviewDto,
  type WorkRecordDto,
} from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { UserStatsService } from '../users/user-stats.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WORK_RECORD_MAX = 100;

const REVIEW_INCLUDE = {
  reviewer: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
  order: { select: { title: true, buyerId: true } },
} as const satisfies Prisma.ReviewInclude;
type ReviewWithRelations = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

function toReviewDto(r: ReviewWithRelations): ReviewDto {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    reply: r.reply,
    repliedAt: r.repliedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    reviewer: { id: r.reviewer.id, displayName: r.reviewer.profile?.displayName ?? '', avatarUrl: r.reviewer.profile?.avatarUrl ?? null },
    reviewerRole: r.reviewerId === r.order.buyerId ? 'BUYER' : 'SELLER',
    orderTitle: r.order.title,
  };
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly stats: UserStatsService,
  ) {}

  /** POST /orders/:id/review */
  async create(userId: string, orderId: string, input: CreateReviewInput): Promise<ReviewDto> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, OR: [{ buyerId: userId }, { sellerId: userId }] },
      select: { id: true, status: true, completedAt: true, buyerId: true, sellerId: true, title: true },
    });
    if (!order) throw AppError.notFound('ORDER_NOT_FOUND', 'Order not found');
    if (order.status !== OrderStatus.COMPLETED || !order.completedAt) {
      throw AppError.unprocessable('ORDER_NOT_COMPLETED', 'You can review only completed orders');
    }
    if (Date.now() > order.completedAt.getTime() + REVIEW_WINDOW_DAYS * DAY_MS) {
      throw AppError.unprocessable('REVIEW_WINDOW_CLOSED', `Reviews can be left within ${REVIEW_WINDOW_DAYS} days of completion`);
    }
    const revieweeId = order.buyerId === userId ? order.sellerId : order.buyerId;
    let created: ReviewWithRelations;
    try {
      created = await this.prisma.review.create({
        data: { orderId, reviewerId: userId, revieweeId, rating: input.rating, comment: input.comment ?? null },
        include: REVIEW_INCLUDE,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.conflict('REVIEW_EXISTS', 'You already reviewed this order');
      }
      throw error;
    }
    await this.notifications.notify(revieweeId, {
      type: NotificationType.REVIEW_RECEIVED,
      title: `New ${input.rating}★ review`,
      body: `${created.reviewer.profile?.displayName ?? 'Someone'} reviewed "${order.title}"`,
      link: { kind: 'order', id: orderId },
    });
    return toReviewDto(created);
  }

  /** POST /reviews/:id/reply — the reviewed person, once (FR-502). */
  async reply(userId: string, reviewId: string, input: ReplyReviewInput): Promise<ReviewDto> {
    const review = await this.prisma.review.findFirst({ where: { id: reviewId, revieweeId: userId }, select: { id: true } });
    if (!review) throw AppError.notFound('REVIEW_NOT_FOUND', 'Review not found');
    const changed = await this.prisma.review.updateMany({
      where: { id: reviewId, reply: null },
      data: { reply: input.reply, repliedAt: new Date() },
    });
    if (changed.count !== 1) throw AppError.conflict('REVIEW_ALREADY_REPLIED', 'You already replied to this review');
    return toReviewDto(await this.prisma.review.findUniqueOrThrow({ where: { id: reviewId }, include: REVIEW_INCLUDE }));
  }

  /** GET /users/:id/reviews — reviews a person received, newest first. */
  async listForUser(userId: string, query: PageQuery): Promise<Page<ReviewDto>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (user?.status !== UserStatus.ACTIVE) throw AppError.notFound('USER_NOT_FOUND', 'User not found');
    const limit = query.limit ?? 20;
    const cursor = decodeCursor(query.cursor, 'id');
    const rows = await this.prisma.review.findMany({
      where: { revieweeId: userId, ...(cursor ? { id: { lt: cursor.v as string } } : {}) },
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: REVIEW_INCLUDE,
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map(toReviewDto),
      nextCursor: rows.length > limit ? encodeCursor({ k: 'id', v: page[page.length - 1]!.id }) : null,
    };
  }

  /** Review state for one order, as seen by `userId` (used by the order detail). */
  async forOrder(userId: string, order: { id: string; status: OrderStatus; completedAt: Date | null }): Promise<OrderReviewsDto> {
    const rows = await this.prisma.review.findMany({ where: { orderId: order.id }, include: REVIEW_INCLUDE });
    const mine = rows.find((r) => r.reviewerId === userId) ?? null;
    const theirs = rows.find((r) => r.reviewerId !== userId) ?? null;
    const deadline = order.completedAt ? new Date(order.completedAt.getTime() + REVIEW_WINDOW_DAYS * DAY_MS) : null;
    return {
      mine: mine ? toReviewDto(mine) : null,
      theirs: theirs ? toReviewDto(theirs) : null,
      canReview: order.status === OrderStatus.COMPLETED && !mine && !!deadline && Date.now() <= deadline.getTime(),
      reviewDeadline: deadline?.toISOString() ?? null,
    };
  }

  /** GET /users/:id/work-record (public) — FR-053. */
  async workRecord(userId: string): Promise<WorkRecordDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        profile: { select: { displayName: true, avatarUrl: true, collegeName: true, studentVerifiedAt: true } },
      },
    });
    if (!user || user.status !== UserStatus.ACTIVE) throw AppError.notFound('USER_NOT_FOUND', 'User not found');
    const [orders, stats] = await Promise.all([
      this.prisma.order.findMany({
        where: { sellerId: userId, status: OrderStatus.COMPLETED },
        orderBy: { completedAt: 'desc' },
        take: WORK_RECORD_MAX,
        select: {
          id: true,
          completedAt: true,
          listing: { select: { category: { select: { name: true } } } },
          reviews: { where: { revieweeId: userId }, select: { rating: true, comment: true } },
        },
      }),
      this.stats.forUsers([userId]),
    ]);
    const s = stats.get(userId)!;
    return {
      userId: user.id,
      displayName: user.profile?.displayName ?? '',
      avatarUrl: user.profile?.avatarUrl ?? null,
      collegeName: user.profile?.collegeName ?? null,
      isStudent: user.profile?.studentVerifiedAt != null,
      memberSince: user.createdAt.toISOString(),
      completedJobs: s.completedJobs,
      rating: { average: s.ratingAverage, count: s.ratingCount },
      entries: orders.map((o) => ({
        orderId: o.id,
        category: o.listing.category.name,
        completedMonth: (o.completedAt ?? new Date()).toISOString().slice(0, 7),
        rating: o.reviews[0]?.rating ?? null,
        comment: o.reviews[0]?.comment ?? null,
      })),
    };
  }
}
