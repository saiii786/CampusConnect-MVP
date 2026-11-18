/**
 * Trust signals shown next to a person (FR-052, FR-201): average rating, number of reviews and
 * completed jobs (as seller). Batched — one query each for any number of users.
 */
import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@cc/shared';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface UserStats {
  ratingAverage: number | null;
  ratingCount: number;
  completedJobs: number;
}

@Injectable()
export class UserStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async forUsers(userIds: string[]): Promise<Map<string, UserStats>> {
    const ids = [...new Set(userIds)];
    const result = new Map<string, UserStats>(ids.map((id) => [id, { ratingAverage: null, ratingCount: 0, completedJobs: 0 }]));
    if (ids.length === 0) return result;

    const [ratings, completed] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['revieweeId'],
        where: { revieweeId: { in: ids } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['sellerId'],
        where: { sellerId: { in: ids }, status: OrderStatus.COMPLETED },
        _count: { _all: true },
      }),
    ]);
    for (const r of ratings) {
      const s = result.get(r.revieweeId)!;
      s.ratingAverage = r._avg.rating === null ? null : Math.round(r._avg.rating * 10) / 10;
      s.ratingCount = r._count._all;
    }
    for (const c of completed) result.get(c.sellerId)!.completedJobs = c._count._all;
    return result;
  }
}
