/**
 * Quotes on job requests (FR-200…203). Accepting a quote creates an order — Phase 5 (OrdersService).
 *
 * Rules:
 *   - only on ACTIVE, visible JOB_REQUESTs; not on your own (FR-153); not between blocked people;
 *     the seller needs a verified email (like posting);
 *   - one quote per seller per job (DB unique). A WITHDRAWN quote can be re-sent; REJECTED /
 *     NOT_SELECTED / ACCEPTED ones cannot;
 *   - seller edits/withdraws only while ACTIVE; the job owner rejects only while ACTIVE;
 *   - sending a quote opens (or reuses) the buyer↔seller conversation and posts the quote in it.
 */
import { Injectable } from '@nestjs/common';
import {
  formatPaise,
  ListingStatus,
  ListingType,
  NotificationType,
  QuoteStatus,
  UserBadge,
  UserStatus,
  type CreateQuoteInput,
  type MyQuoteDto,
  type QuoteDto,
  type UpdateQuoteInput,
} from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ConversationsService } from '../conversations/conversations.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BlocksService } from '../safety/blocks.service.js';
import { assertContentAllowed } from '../safety/content-guard.js';
import { UserStatsService, type UserStats } from '../users/user-stats.service.js';

const QUOTE_INCLUDE = {
  seller: {
    select: {
      id: true,
      emailVerifiedAt: true,
      profile: { select: { displayName: true, avatarUrl: true, studentVerifiedAt: true } },
    },
  },
  listing: {
    select: {
      id: true,
      title: true,
      status: true,
      ownerId: true,
      owner: { select: { profile: { select: { displayName: true } } } },
    },
  },
} as const satisfies Prisma.QuoteInclude;
type QuoteWithRelations = Prisma.QuoteGetPayload<{ include: typeof QUOTE_INCLUDE }>;

const notFound = () => AppError.notFound('QUOTE_NOT_FOUND', 'Quote not found');
const dateOrNull = (d: string | null | undefined) => (d ? new Date(`${d}T00:00:00.000Z`) : null);

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly blocks: BlocksService,
    private readonly stats: UserStatsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** POST /listings/:id/quotes */
  async create(sellerId: string, listingId: string, input: CreateQuoteInput): Promise<QuoteDto> {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id: listingId,
        deletedAt: null,
        status: ListingStatus.ACTIVE,
        category: { sensitive: false },
        owner: { status: UserStatus.ACTIVE },
      },
      select: { id: true, ownerId: true, type: true },
    });
    if (!listing) throw AppError.notFound('LISTING_NOT_FOUND', 'Listing not found');
    if (listing.type !== ListingType.JOB_REQUEST) {
      throw AppError.unprocessable('QUOTE_NOT_ALLOWED', 'Quotes can only be sent for job requests');
    }
    if (listing.ownerId === sellerId) {
      throw AppError.unprocessable('CANNOT_QUOTE_OWN_LISTING', 'You cannot quote on your own job request');
    }
    await this.blocks.assertNotBlocked(sellerId, listing.ownerId);
    assertContentAllowed(input.message);

    const data = { amountPaise: input.amountPaise, message: input.message, etaDate: dateOrNull(input.etaDate) };
    const existing = await this.prisma.quote.findUnique({
      where: { listingId_sellerId: { listingId, sellerId } },
      select: { id: true, status: true },
    });
    let quoteId: string;
    if (!existing) {
      quoteId = (await this.prisma.quote.create({ data: { listingId, sellerId, ...data } })).id;
    } else if (existing.status === QuoteStatus.WITHDRAWN) {
      const revived = await this.prisma.quote.updateMany({
        where: { id: existing.id, status: QuoteStatus.WITHDRAWN },
        data: { ...data, status: QuoteStatus.ACTIVE },
      });
      if (revived.count !== 1) throw quoteExists();
      quoteId = existing.id;
    } else if (existing.status === QuoteStatus.ACTIVE) {
      throw quoteExists();
    } else {
      throw AppError.conflict('QUOTE_CLOSED', 'Your quote for this job can no longer be changed');
    }

    const conversation = await this.conversations.ensure(listingId, listing.ownerId, sellerId);
    const note = input.message.length > 300 ? `${input.message.slice(0, 300)}…` : input.message;
    await this.conversations.postMessage(conversation, sellerId, `💼 Quote: ${formatPaise(input.amountPaise)}\n${note}`, { notify: false });
    const dto = await this.getDto(quoteId);
    await this.notifications.notify(listing.ownerId, {
      type: NotificationType.QUOTE_NEW,
      title: `New quote: ${formatPaise(input.amountPaise)}`,
      body: `${dto.seller.displayName} sent a quote for your job`,
      link: { kind: 'quotes', id: listingId },
    });
    return dto;
  }

  /** GET /listings/:id/quotes — job owner only; ACTIVE first, then cheapest. */
  async listForListing(ownerId: string, listingId: string): Promise<QuoteDto[]> {
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, ownerId, deletedAt: null }, select: { id: true } });
    if (!listing) throw AppError.notFound('LISTING_NOT_FOUND', 'Listing not found');
    const rows = await this.prisma.quote.findMany({
      where: { listingId },
      orderBy: [{ amountPaise: 'asc' }, { createdAt: 'asc' }],
      include: QUOTE_INCLUDE,
    });
    const active = rows.filter((q) => q.status === QuoteStatus.ACTIVE);
    const others = rows.filter((q) => q.status !== QuoteStatus.ACTIVE);
    return this.toDtos([...active, ...others]);
  }

  /** GET /me/quotes — my quotes as a seller (newest first, max 100). */
  async mine(sellerId: string): Promise<MyQuoteDto[]> {
    const rows = await this.prisma.quote.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: QUOTE_INCLUDE,
    });
    const dtos = await this.toDtos(rows);
    return dtos.map((dto, i) => {
      const l = rows[i]!.listing;
      return { ...dto, listing: { id: l.id, title: l.title, status: l.status, ownerName: l.owner.profile?.displayName ?? '' } };
    });
  }

  /** PATCH /quotes/:id — seller, while ACTIVE and the job is still ACTIVE. */
  async update(sellerId: string, quoteId: string, input: UpdateQuoteInput): Promise<QuoteDto> {
    const quote = await this.prisma.quote.findFirst({ where: { id: quoteId, sellerId }, include: { listing: { select: { status: true } } } });
    if (!quote) throw notFound();
    if (quote.listing.status !== ListingStatus.ACTIVE) throw AppError.conflict('LISTING_NOT_ACTIVE', 'This job is no longer open');
    assertContentAllowed(input.message);
    const changed = await this.prisma.quote.updateMany({
      where: { id: quoteId, status: QuoteStatus.ACTIVE },
      data: {
        amountPaise: input.amountPaise,
        message: input.message,
        ...(input.etaDate !== undefined ? { etaDate: dateOrNull(input.etaDate) } : {}),
      },
    });
    if (changed.count !== 1) throw invalidStatus(quote.status);
    return this.getDto(quoteId);
  }

  /** POST /quotes/:id/withdraw — seller. */
  async withdraw(sellerId: string, quoteId: string): Promise<QuoteDto> {
    return this.transition(quoteId, { sellerId }, QuoteStatus.WITHDRAWN);
  }

  /** POST /quotes/:id/reject — job owner (FR-203). */
  async reject(ownerId: string, quoteId: string): Promise<QuoteDto> {
    return this.transition(quoteId, { listing: { ownerId } }, QuoteStatus.REJECTED);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async transition(quoteId: string, who: Prisma.QuoteWhereInput, to: QuoteStatus): Promise<QuoteDto> {
    const quote = await this.prisma.quote.findFirst({ where: { id: quoteId, ...who }, select: { status: true } });
    if (!quote) throw notFound();
    const changed = await this.prisma.quote.updateMany({ where: { id: quoteId, status: QuoteStatus.ACTIVE }, data: { status: to } });
    if (changed.count !== 1) throw invalidStatus(quote.status);
    return this.getDto(quoteId);
  }

  private async getDto(quoteId: string): Promise<QuoteDto> {
    const row = await this.prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, include: QUOTE_INCLUDE });
    const [dto] = await this.toDtos([row]);
    return dto!;
  }

  private async toDtos(rows: QuoteWithRelations[]): Promise<QuoteDto[]> {
    if (rows.length === 0) return [];
    const stats = await this.stats.forUsers(rows.map((q) => q.sellerId));
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: rows.map((q) => ({ listingId: q.listingId, buyerId: q.listing.ownerId, sellerId: q.sellerId })) },
      select: { id: true, listingId: true, sellerId: true },
    });
    const convBy = new Map(conversations.map((c) => [`${c.listingId}:${c.sellerId}`, c.id]));
    return rows.map((q) => toQuoteDto(q, stats.get(q.sellerId)!, convBy.get(`${q.listingId}:${q.sellerId}`) ?? null));
  }
}

function toQuoteDto(q: QuoteWithRelations, s: UserStats, conversationId: string | null): QuoteDto {
  const badges: UserBadge[] = [];
  if (q.seller.profile?.studentVerifiedAt) badges.push(UserBadge.STUDENT);
  if (q.seller.emailVerifiedAt) badges.push(UserBadge.EMAIL_VERIFIED);
  return {
    id: q.id,
    listingId: q.listingId,
    status: q.status,
    amountPaise: q.amountPaise,
    message: q.message,
    etaDate: q.etaDate ? q.etaDate.toISOString().slice(0, 10) : null,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    seller: {
      id: q.seller.id,
      displayName: q.seller.profile?.displayName ?? '',
      avatarUrl: q.seller.profile?.avatarUrl ?? null,
      badges,
      rating: { average: s.ratingAverage, count: s.ratingCount },
      completedJobs: s.completedJobs,
    },
    conversationId,
  };
}

function quoteExists(): AppError {
  return AppError.conflict('QUOTE_EXISTS', 'You already sent a quote for this job — edit it instead');
}

function invalidStatus(status: string): AppError {
  return AppError.conflict('QUOTE_INVALID_STATUS', 'This quote can no longer be changed', { status });
}
