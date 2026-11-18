/**
 * Blocking (FR-253): once either person blocks the other, they cannot message each other, start
 * a conversation, send quotes, or (Phase 5) create orders together. Blocking is silent: the
 * blocked person is not notified, but sending fails with 403 USER_BLOCKED.
 */
import { Injectable } from '@nestjs/common';
import type { BlockedUserDto } from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class BlocksService {
  constructor(private readonly prisma: PrismaService) {}

  /** True if a blocked b OR b blocked a. */
  async isBlockedBetween(a: string, b: string): Promise<boolean> {
    const count = await this.prisma.block.count({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    return count > 0;
  }

  async assertNotBlocked(a: string, b: string): Promise<void> {
    if (await this.isBlockedBetween(a, b)) {
      throw AppError.forbidden('USER_BLOCKED', 'You cannot interact with this person');
    }
  }

  /** Ids (among `others`) that are blocked with `userId` in either direction. */
  async blockedAmong(userId: string, others: string[]): Promise<Set<string>> {
    if (others.length === 0) return new Set();
    const rows = await this.prisma.block.findMany({
      where: {
        OR: [
          { blockerId: userId, blockedId: { in: others } },
          { blockedId: userId, blockerId: { in: others } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    });
    return new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)));
  }

  async block(userId: string, targetId: string): Promise<void> {
    if (userId === targetId) throw AppError.badRequest('CANNOT_BLOCK_SELF', 'You cannot block yourself');
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) throw AppError.notFound('USER_NOT_FOUND', 'User not found');
    await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: targetId } },
      create: { blockerId: userId, blockedId: targetId },
      update: {},
    });
  }

  async unblock(userId: string, targetId: string): Promise<void> {
    await this.prisma.block.deleteMany({ where: { blockerId: userId, blockedId: targetId } });
  }

  async list(userId: string): Promise<BlockedUserDto[]> {
    const rows = await this.prisma.block.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { blocked: { select: { profile: { select: { displayName: true } } } } },
    });
    return rows.map((r) => ({
      userId: r.blockedId,
      displayName: r.blocked.profile?.displayName ?? '',
      blockedAt: r.createdAt.toISOString(),
    }));
  }
}
