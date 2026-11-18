/**
 * Chat (FR-250…253). Only the two participants can read or write (others get 404, so ids
 * cannot be probed). Blocked pairs cannot send. Sending stores the message, bumps
 * `lastMessageAt`, marks it read for the sender, then emits `message:new` over the socket.
 */
import { Injectable } from '@nestjs/common';
import {
  ListingType,
  NotificationType,
  ServerEvent,
  UserStatus,
  type ConversationDto,
  type ConversationReadEvent,
  type MessageDto,
  type Page,
  type PageQuery,
  type UnreadSummaryDto,
} from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor.js';
import type { Conversation, Message } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { conversationRoom, RealtimeService, userRoom } from '../realtime/realtime.service.js';
import { BlocksService } from '../safety/blocks.service.js';
import { assertContentAllowed, MESSAGE_LIMIT_PER_MINUTE, tooManyRequests } from '../safety/content-guard.js';

const PAGE_DEFAULT = 20;
const notFound = () => AppError.notFound('CONVERSATION_NOT_FOUND', 'Conversation not found');

const CONVERSATION_INCLUDE = {
  listing: { select: { id: true, title: true, type: true } },
  buyer: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
  seller: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
} as const;

type ConversationWithPeople = Conversation & {
  listing: { id: string; title: string; type: string };
  buyer: { id: string; profile: { displayName: string; avatarUrl: string | null } | null };
  seller: { id: string; profile: { displayName: string; avatarUrl: string | null } | null };
};

export const REMOVED_MESSAGE = '[This message was removed by a moderator]';

export function toMessageDto(m: Message): MessageDto {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    body: m.hiddenAt ? REMOVED_MESSAGE : m.body,
    createdAt: m.createdAt.toISOString(),
  };
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Find or create the conversation for (listing, buyer, seller). Used by `start` and by quotes.
   * Idempotent under concurrency (unique key + upsert).
   */
  async ensure(listingId: string, buyerId: string, sellerId: string): Promise<Conversation> {
    return this.prisma.conversation.upsert({
      where: { listingId_buyerId_sellerId: { listingId, buyerId, sellerId } },
      create: { listingId, buyerId, sellerId },
      update: {},
    });
  }

  /** POST /conversations — contact the owner of a listing. */
  async start(userId: string, listingId: string): Promise<ConversationDto> {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id: listingId,
        status: 'ACTIVE',
        deletedAt: null,
        category: { sensitive: false },
        owner: { status: UserStatus.ACTIVE },
      },
      select: { id: true, ownerId: true, type: true },
    });
    if (!listing) throw AppError.notFound('LISTING_NOT_FOUND', 'Listing not found');
    if (listing.ownerId === userId) {
      throw AppError.unprocessable('CANNOT_CONTACT_SELF', 'This is your own listing');
    }
    await this.blocks.assertNotBlocked(userId, listing.ownerId);
    // Service offer: I am the buyer. Job request: the owner is the buyer and I am the seller.
    const [buyerId, sellerId] =
      listing.type === ListingType.JOB_REQUEST ? [listing.ownerId, userId] : [userId, listing.ownerId];
    const conversation = await this.ensure(listing.id, buyerId, sellerId);
    return this.getOne(userId, conversation.id);
  }

  async getOne(userId: string, conversationId: string): Promise<ConversationDto> {
    const c = await this.findForParticipant(userId, conversationId);
    const [dto] = await this.toDtos(userId, [c]);
    return dto!;
  }

  /** GET /conversations — most recent activity first. */
  async list(userId: string, query: PageQuery): Promise<Page<ConversationDto>> {
    const limit = query.limit ?? PAGE_DEFAULT;
    const offset = (decodeCursor(query.cursor, 'off')?.v as number | undefined) ?? 0;
    const rows = (await this.prisma.conversation.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      skip: offset,
      take: limit + 1,
      include: CONVERSATION_INCLUDE,
    })) as ConversationWithPeople[];
    const items = await this.toDtos(userId, rows.slice(0, limit));
    return { items, nextCursor: rows.length > limit ? encodeCursor({ k: 'off', v: offset + limit }) : null };
  }

  /** GET /conversations/:id/messages — newest first; pass nextCursor for older messages. */
  async messages(userId: string, conversationId: string, query: PageQuery): Promise<Page<MessageDto>> {
    await this.findForParticipant(userId, conversationId);
    const limit = query.limit ?? 30;
    const cursor = decodeCursor(query.cursor, 'id');
    const rows = await this.prisma.message.findMany({
      where: { conversationId, ...(cursor ? { id: { lt: cursor.v as string } } : {}) },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map(toMessageDto),
      nextCursor: rows.length > limit ? encodeCursor({ k: 'id', v: page[page.length - 1]!.id }) : null,
    };
  }

  /** POST /conversations/:id/messages */
  async send(userId: string, conversationId: string, body: string): Promise<MessageDto> {
    const c = await this.findForParticipant(userId, conversationId);
    const otherId = c.buyerId === userId ? c.sellerId : c.buyerId;
    await this.blocks.assertNotBlocked(userId, otherId);
    const other = await this.prisma.user.findUnique({ where: { id: otherId }, select: { status: true } });
    if (other?.status !== UserStatus.ACTIVE) {
      throw AppError.conflict('RECIPIENT_UNAVAILABLE', 'This person can no longer receive messages');
    }
    assertContentAllowed(body);
    const recent = await this.prisma.message.count({ where: { senderId: userId, createdAt: { gte: new Date(Date.now() - 60_000) } } });
    if (recent >= MESSAGE_LIMIT_PER_MINUTE) throw tooManyRequests('messages');
    return this.postMessage(c, userId, body);
  }

  /**
   * Store + deliver a message. Also used by quotes/orders ("Quote: ₹…"), which pass
   * `notify: false` because they send their own, more specific notification. Caller has done all checks.
   */
  async postMessage(c: Conversation, senderId: string, body: string, options: { notify?: boolean } = {}): Promise<MessageDto> {
    const now = new Date();
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { conversationId: c.id, senderId, body, createdAt: now } }),
      this.prisma.conversation.update({ where: { id: c.id }, data: { lastMessageAt: now } }),
      this.prisma.conversationRead.upsert({
        where: { conversationId_userId: { conversationId: c.id, userId: senderId } },
        create: { conversationId: c.id, userId: senderId, lastReadAt: now },
        update: { lastReadAt: now },
      }),
    ]);
    const dto = toMessageDto(message);
    this.realtime.emit(
      [conversationRoom(c.id), userRoom(c.buyerId), userRoom(c.sellerId)],
      ServerEvent.MESSAGE_NEW,
      dto,
    );
    if (options.notify !== false) {
      const recipientId = c.buyerId === senderId ? c.sellerId : c.buyerId;
      const sender = await this.prisma.profile.findUnique({ where: { userId: senderId }, select: { displayName: true } });
      await this.notifications.notify(recipientId, {
        type: NotificationType.MESSAGE_NEW,
        title: sender?.displayName ?? 'New message',
        body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
        link: { kind: 'conversation', id: c.id },
      });
    }
    return dto;
  }

  /** POST /conversations/:id/read — everything up to now is read. */
  async markRead(userId: string, conversationId: string): Promise<ConversationReadEvent> {
    const c = await this.findForParticipant(userId, conversationId);
    const now = new Date();
    await this.prisma.conversationRead.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId, lastReadAt: now },
      update: { lastReadAt: now },
    });
    const event: ConversationReadEvent = { conversationId, userId, lastReadAt: now.toISOString() };
    this.realtime.emit([conversationRoom(conversationId), userRoom(c.buyerId), userRoom(c.sellerId)], ServerEvent.CONVERSATION_READ, event);
    return event;
  }

  /** GET /conversations/unread — totals for the Messages badge. */
  async unreadSummary(userId: string): Promise<UnreadSummaryDto> {
    const rows = await this.prisma.$queryRaw<{ conversations: number; messages: number }[]>`
      SELECT count(DISTINCT m."conversationId")::int AS conversations, count(*)::int AS messages
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      LEFT JOIN "ConversationRead" r ON r."conversationId" = m."conversationId" AND r."userId" = ${userId}::uuid
      WHERE (c."buyerId" = ${userId}::uuid OR c."sellerId" = ${userId}::uuid)
        AND m."senderId" <> ${userId}::uuid
        AND (r."lastReadAt" IS NULL OR m."createdAt" > r."lastReadAt")`;
    return { unreadConversations: rows[0]?.conversations ?? 0, unreadMessages: rows[0]?.messages ?? 0 };
  }

  /** Throws 404 unless `userId` is the buyer or the seller. */
  async findForParticipant(userId: string, conversationId: string): Promise<ConversationWithPeople> {
    const c = (await this.prisma.conversation.findFirst({
      where: { id: conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: CONVERSATION_INCLUDE,
    })) as ConversationWithPeople | null;
    if (!c) throw notFound();
    return c;
  }

  private async toDtos(userId: string, rows: ConversationWithPeople[]): Promise<ConversationDto[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [lastMessages, unread, blocked] = await Promise.all([
      this.prisma.$queryRaw<{ conversationId: string; body: string; senderId: string; createdAt: Date; hiddenAt: Date | null }[]>`
        SELECT DISTINCT ON ("conversationId") "conversationId", body, "senderId", "createdAt", "hiddenAt"
        FROM "Message" WHERE "conversationId" = ANY(${ids}::uuid[])
        ORDER BY "conversationId", "createdAt" DESC, id DESC`,
      this.prisma.$queryRaw<{ conversationId: string; unread: number }[]>`
        SELECT m."conversationId", count(*)::int AS unread
        FROM "Message" m
        LEFT JOIN "ConversationRead" r ON r."conversationId" = m."conversationId" AND r."userId" = ${userId}::uuid
        WHERE m."conversationId" = ANY(${ids}::uuid[]) AND m."senderId" <> ${userId}::uuid
          AND (r."lastReadAt" IS NULL OR m."createdAt" > r."lastReadAt")
        GROUP BY m."conversationId"`,
      this.blocks.blockedAmong(
        userId,
        rows.map((r) => (r.buyerId === userId ? r.sellerId : r.buyerId)),
      ),
    ]);
    const lastBy = new Map(lastMessages.map((m) => [m.conversationId, m]));
    const unreadBy = new Map(unread.map((u) => [u.conversationId, u.unread]));
    return rows.map((c) => {
      const iAmBuyer = c.buyerId === userId;
      const other = iAmBuyer ? c.seller : c.buyer;
      const last = lastBy.get(c.id);
      return {
        id: c.id,
        listing: { id: c.listing.id, title: c.listing.title, type: c.listing.type as ConversationDto['listing']['type'] },
        myRole: iAmBuyer ? 'BUYER' : 'SELLER',
        other: { id: other.id, displayName: other.profile?.displayName ?? '', avatarUrl: other.profile?.avatarUrl ?? null },
        lastMessage: last
          ? { body: last.hiddenAt ? REMOVED_MESSAGE : last.body, senderId: last.senderId, createdAt: last.createdAt.toISOString() }
          : null,
        unreadCount: unreadBy.get(c.id) ?? 0,
        blocked: blocked.has(other.id),
        createdAt: c.createdAt.toISOString(),
      };
    });
  }
}
