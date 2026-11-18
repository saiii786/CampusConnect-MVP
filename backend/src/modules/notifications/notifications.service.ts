/**
 * Notifications (FR-550, FR-551). Feature services call `notify()` AFTER their own change is
 * committed. It stores the in-app notification, emits `notification:new` over the socket and
 * sends a push (best effort). It never throws — a failed notification must not undo an order.
 *
 * Chat messages do not create one notification each: an unread MESSAGE_NEW notification for the
 * same conversation is updated instead (no flood of notifications for one chat).
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationType,
  ServerEvent,
  type NotificationDto,
  type NotificationLink,
  type Page,
  type PageQuery,
  type PushTokenInput,
} from '@cc/shared';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor.js';
import type { Notification, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeService, userRoom } from '../realtime/realtime.service.js';
import { PushService } from './push.service.js';

interface StoredPayload {
  title: string;
  body: string;
  link: NotificationLink | null;
}

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  link?: NotificationLink | null;
}

export function toNotificationDto(n: Notification): NotificationDto {
  const p = n.payload as unknown as StoredPayload;
  return {
    id: n.id,
    type: n.type as NotificationType,
    title: p.title,
    body: p.body,
    link: p.link ?? null,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
  ) {}

  /** Store + deliver. Never throws. */
  async notify(userId: string, input: NotifyInput): Promise<void> {
    try {
      const payload: StoredPayload = { title: input.title, body: input.body, link: input.link ?? null };
      let notification: Notification | null = null;

      if (input.type === NotificationType.MESSAGE_NEW && input.link?.kind === 'conversation') {
        const existing = await this.prisma.notification.findFirst({
          where: { userId, type: input.type, readAt: null, payload: { path: ['link', 'id'], equals: input.link.id } },
          select: { id: true },
        });
        if (existing) {
          notification = await this.prisma.notification.update({
            where: { id: existing.id },
            data: { payload: payload as unknown as Prisma.InputJsonValue, createdAt: new Date() },
          });
        }
      }
      notification ??= await this.prisma.notification.create({
        data: { userId, type: input.type, payload: payload as unknown as Prisma.InputJsonValue },
      });

      this.realtime.emit([userRoom(userId)], ServerEvent.NOTIFICATION_NEW, toNotificationDto(notification));
      await this.push.sendToUser(userId, { title: input.title, body: input.body, data: { link: input.link ?? null } });
    } catch (error) {
      this.logger.error(`notify(${input.type}) failed for ${userId}: ${(error as Error).message}`);
    }
  }

  async list(userId: string, query: PageQuery): Promise<Page<NotificationDto> & { unreadCount: number }> {
    const limit = query.limit ?? 20;
    const cursor = decodeCursor(query.cursor, 'off');
    const offset = (cursor?.v as number | undefined) ?? 0;
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit + 1,
      }),
      this.unreadCount(userId),
    ]);
    return {
      items: rows.slice(0, limit).map(toNotificationDto),
      nextCursor: rows.length > limit ? encodeCursor({ k: 'off', v: offset + limit }) : null,
      unreadCount,
    };
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, ids?: string[]): Promise<{ unreadCount: number }> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return { unreadCount: await this.unreadCount(userId) };
  }

  /** A device token belongs to the last user who signed in on it. */
  async registerPushToken(userId: string, input: PushTokenInput): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token: input.token },
      create: { token: input.token, userId, platform: input.platform ?? 'unknown' },
      update: { userId, platform: input.platform ?? 'unknown' },
    });
  }

  async removePushToken(userId: string, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { token, userId } });
  }
}
