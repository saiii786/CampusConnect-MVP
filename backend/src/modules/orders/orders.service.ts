/**
 * Orders (FR-400…409, ARCHITECTURE §6, ADR-012).
 *
 * Creation:
 *   - book(): buyer books a SERVICE_OFFER → REQUESTED (seller accepts/declines).
 *   - acceptQuote(): job owner accepts a quote → AWAITING_PAYMENT (escrow) / IN_PROGRESS (direct);
 *     in ONE transaction the quote becomes ACCEPTED, other open quotes NOT_SELECTED, the job CLOSED.
 * Changes: transition() is the ONLY way an order's status changes. It asks the shared state
 *   machine, then updates with `WHERE id AND version` (optimistic lock) and writes the timeline
 *   event in the same transaction. Money effects (escrow) are applied by the wallet in Phase 6.
 * On-site check (FR-406): 4-digit start/finish codes derived from HMAC(secret, order id) — nothing
 *   to store; only the buyer is shown them; the seller must enter them to start / submit.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  AUTO_APPROVE_AFTER_DAYS,
  availableOrderActions,
  formatPaise,
  initialOrderStatus,
  ListingStatus,
  ListingType,
  MAX_AMOUNT_PAISE,
  MAX_CHANGE_REQUESTS,
  OrderAction,
  OrderActor,
  OrderSource,
  OrderStatus,
  PaymentMode,
  PricingType,
  QuoteStatus,
  resolveOrderTransition,
  ServerEvent,
  TransitionErrorCode,
  USER_ORDER_ACTIONS,
  UserStatus,
  WorkMode,
  type AcceptQuoteInput,
  type BookServiceInput,
  type ListOrdersInput,
  type MoneyEffect,
  type OrderActionBody,
  type OrderDetailDto,
  type OrderSummaryDto,
  type OrderUpdatedEvent,
  type Page,
  type UserOrderAction,
} from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor.js';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ConversationsService } from '../conversations/conversations.service.js';
import { RealtimeService, userRoom } from '../realtime/realtime.service.js';
import { BlocksService } from '../safety/blocks.service.js';

const ORDER_INCLUDE = {
  listing: { select: { id: true, workMode: true } },
  buyer: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
  seller: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
} as const satisfies Prisma.OrderInclude;
type OrderWithParties = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

const DETAIL_INCLUDE = {
  ...ORDER_INCLUDE,
  events: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  dispute: true,
} as const satisfies Prisma.OrderInclude;
type OrderWithDetail = Prisma.OrderGetPayload<{ include: typeof DETAIL_INCLUDE }>;

type Tx = Prisma.TransactionClient;

const notFound = () => AppError.notFound('ORDER_NOT_FOUND', 'Order not found');
const dateOrNull = (d: string | null | undefined) => (d ? new Date(`${d}T00:00:00.000Z`) : null);
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Applies escrow money movements inside the order's transaction. Provided by the wallet module
 * (Phase 6). Until then no ESCROW order can be created, so this is never reached.
 */
export const ORDER_MONEY = Symbol('ORDER_MONEY');
export interface OrderMoney {
  readonly escrowEnabled: boolean;
  apply(tx: Tx, order: { id: string; buyerId: string; sellerId: string; amountPaise: number }, effect: MoneyEffect): Promise<void>;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly blocks: BlocksService,
    private readonly realtime: RealtimeService,
    @Inject(APP_ENV) private readonly env: AppEnv,
    @Inject(ORDER_MONEY) private readonly money: OrderMoney,
  ) {}

  // ── Creation ──────────────────────────────────────────────────────────────

  /** POST /orders — book a service offer. */
  async book(buyerId: string, input: BookServiceInput): Promise<OrderDetailDto> {
    this.assertPaymentMode(input.paymentMode);
    const listing = await this.prisma.listing.findFirst({
      where: {
        id: input.listingId,
        deletedAt: null,
        status: ListingStatus.ACTIVE,
        category: { sensitive: false },
        owner: { status: UserStatus.ACTIVE },
      },
    });
    if (!listing) throw AppError.notFound('LISTING_NOT_FOUND', 'Listing not found');
    if (listing.type !== ListingType.SERVICE_OFFER) {
      throw AppError.unprocessable('BOOKING_NOT_ALLOWED', 'Only service offers can be booked — send a quote for job requests');
    }
    if (listing.ownerId === buyerId) throw AppError.unprocessable('CANNOT_ORDER_OWN_LISTING', 'You cannot book your own service');
    await this.blocks.assertNotBlocked(buyerId, listing.ownerId);

    const amountPaise = bookingAmount(listing, input);
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          buyerId,
          sellerId: listing.ownerId,
          listingId: listing.id,
          title: listing.title,
          requirements: input.requirements || null,
          amountPaise,
          paymentMode: input.paymentMode,
          status: initialOrderStatus(OrderSource.BOOKING, input.paymentMode),
          deadline: dateOrNull(input.deadline),
        },
      });
      await tx.orderEvent.create({
        data: { orderId: created.id, actorId: buyerId, action: 'book', fromStatus: null, toStatus: created.status, note: input.requirements || null },
      });
      return created;
    });

    await this.notifyInChat(order, buyerId, `📦 Booking request: ${formatPaise(amountPaise)}${input.requirements ? `\n${input.requirements}` : ''}`);
    this.emitUpdate(order);
    return this.getDetail(buyerId, order.id);
  }

  /** POST /quotes/:id/accept — job owner accepts a quote (FR-202). */
  async acceptQuote(buyerId: string, quoteId: string, input: AcceptQuoteInput): Promise<OrderDetailDto> {
    this.assertPaymentMode(input.paymentMode);
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, listing: { ownerId: buyerId } },
      include: { listing: true, seller: { select: { status: true } } },
    });
    if (!quote) throw AppError.notFound('QUOTE_NOT_FOUND', 'Quote not found');
    if (quote.status !== QuoteStatus.ACTIVE) {
      throw AppError.conflict('QUOTE_INVALID_STATUS', 'This quote can no longer be accepted', { status: quote.status });
    }
    if (quote.listing.status !== ListingStatus.ACTIVE) throw AppError.conflict('LISTING_NOT_ACTIVE', 'This job is no longer open');
    if (quote.seller.status !== UserStatus.ACTIVE) {
      throw AppError.conflict('RECIPIENT_UNAVAILABLE', 'This seller is no longer available');
    }
    await this.blocks.assertNotBlocked(buyerId, quote.sellerId);

    const status = initialOrderStatus(OrderSource.QUOTE, input.paymentMode);
    const order = await this.prisma.$transaction(async (tx) => {
      // All three are conditional: a concurrent accept/withdraw/close makes this fail cleanly.
      const accepted = await tx.quote.updateMany({ where: { id: quoteId, status: QuoteStatus.ACTIVE }, data: { status: QuoteStatus.ACCEPTED } });
      const closed = await tx.listing.updateMany({
        where: { id: quote.listingId, status: ListingStatus.ACTIVE },
        data: { status: ListingStatus.CLOSED },
      });
      if (accepted.count !== 1 || closed.count !== 1) {
        throw AppError.conflict('QUOTE_INVALID_STATUS', 'This quote or job changed — please refresh');
      }
      await tx.quote.updateMany({
        where: { listingId: quote.listingId, status: QuoteStatus.ACTIVE },
        data: { status: QuoteStatus.NOT_SELECTED },
      });
      const created = await tx.order.create({
        data: {
          buyerId,
          sellerId: quote.sellerId,
          listingId: quote.listingId,
          quoteId,
          title: quote.listing.title,
          requirements: input.requirements || null,
          amountPaise: quote.amountPaise,
          paymentMode: input.paymentMode,
          status,
          deadline: dateOrNull(input.deadline) ?? quote.etaDate,
        },
      });
      await tx.orderEvent.create({
        data: { orderId: created.id, actorId: buyerId, action: 'accept-quote', fromStatus: null, toStatus: status, note: null },
      });
      return created;
    });

    await this.notifyInChat(order, buyerId, `✅ Quote accepted — order started for ${formatPaise(order.amountPaise)}`);
    this.emitUpdate(order);
    return this.getDetail(buyerId, order.id);
  }

  // ── Status changes ────────────────────────────────────────────────────────

  /** POST /orders/:id/actions/:action — the single entry point for user status changes. */
  async act(userId: string, orderId: string, action: UserOrderAction, body: OrderActionBody): Promise<OrderDetailDto> {
    const order = await this.findForParticipant(userId, orderId);
    const actor = order.buyerId === userId ? OrderActor.BUYER : OrderActor.SELLER;

    if (action === OrderAction.DISPUTE && !body.reason) {
      throw AppError.badRequest('VALIDATION_FAILED', 'Explain the problem', [{ path: 'reason', message: 'A reason is required' }]);
    }
    if (action === OrderAction.SUBMIT && order.listing.workMode === WorkMode.ONSITE) {
      if (!order.startedAt) throw AppError.unprocessable('ORDER_NOT_STARTED', 'Enter the start code from the buyer first');
      if (!body.code || !this.codeMatches(order.id, 'finish', body.code)) {
        throw AppError.badRequest('ORDER_CODE_INVALID', 'That finish code is not correct');
      }
    }

    await this.transition(order, action, actor, userId, body.reason ?? body.note ?? null);
    return this.getDetail(userId, orderId);
  }

  /**
   * Apply one state-machine transition. Used by user actions, and later by the scheduler
   * (auto-approve) and admins (dispute resolution).
   */
  async transition(
    order: { id: string; status: OrderStatus; paymentMode: PaymentMode; changeRequests: number; version: number; buyerId: string; sellerId: string; amountPaise: number },
    action: OrderAction,
    actor: OrderActor,
    actorId: string | null,
    note: string | null,
  ): Promise<void> {
    const result = resolveOrderTransition(
      { status: order.status, paymentMode: order.paymentMode, changeRequests: order.changeRequests },
      action,
      actor,
    );
    if (!result.ok) {
      const status = result.code === TransitionErrorCode.NOT_ALLOWED_FOR_ACTOR ? 403 : result.code === TransitionErrorCode.RULE_VIOLATION ? 422 : 409;
      throw new AppError(result.code, result.message, status, { status: order.status });
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: order.id, version: order.version },
        data: {
          status: result.to,
          version: { increment: 1 },
          ...(action === OrderAction.REQUEST_CHANGES ? { changeRequests: { increment: 1 } } : {}),
          ...(action === OrderAction.SUBMIT ? { submittedAt: now } : {}),
          ...(result.to === OrderStatus.COMPLETED ? { completedAt: now } : {}),
        },
      });
      if (updated.count !== 1) {
        throw AppError.conflict('ORDER_CHANGED', 'This order was just updated — please refresh and try again');
      }
      await tx.orderEvent.create({
        data: { orderId: order.id, actorId, action, fromStatus: order.status, toStatus: result.to, note, createdAt: now },
      });
      if (action === OrderAction.DISPUTE && actorId) {
        await tx.dispute.upsert({
          where: { orderId: order.id },
          create: { orderId: order.id, raisedById: actorId, reason: note ?? '' },
          update: { raisedById: actorId, reason: note ?? '', status: 'OPEN', resolvedAt: null, resolvedById: null, resolutionNote: null },
        });
      }
      if (result.moneyEffect) await this.money.apply(tx, order, result.moneyEffect);
    });
    this.emitUpdate({ ...order, status: result.to });
  }

  /** POST /orders/:id/start — seller enters the buyer's start code at the site (FR-406). */
  async start(userId: string, orderId: string, code: string): Promise<OrderDetailDto> {
    const order = await this.findForParticipant(userId, orderId);
    if (order.sellerId !== userId) throw AppError.forbidden('ORDER_ACTION_NOT_ALLOWED', 'Only the seller enters the start code');
    if (order.listing.workMode !== WorkMode.ONSITE) throw AppError.unprocessable('ORDER_NOT_ONSITE', 'Start codes are only for on-site jobs');
    if (order.status !== OrderStatus.IN_PROGRESS) throw AppError.conflict('ORDER_INVALID_TRANSITION', 'The order is not in progress');
    if (order.startedAt) throw AppError.conflict('ORDER_ALREADY_STARTED', 'This job was already started');
    if (!this.codeMatches(order.id, 'start', code)) throw AppError.badRequest('ORDER_CODE_INVALID', 'That start code is not correct');

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.order.updateMany({ where: { id: orderId, startedAt: null }, data: { startedAt: now } }),
      this.prisma.orderEvent.create({
        data: { orderId, actorId: userId, action: 'start', fromStatus: order.status, toStatus: order.status, createdAt: now },
      }),
    ]);
    this.emitUpdate(order);
    return this.getDetail(userId, orderId);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async list(userId: string, query: ListOrdersInput): Promise<Page<OrderSummaryDto>> {
    const limit = query.limit ?? 20;
    const cursor = decodeCursor(query.cursor, 'id');
    const rows = await this.prisma.order.findMany({
      where: {
        ...(query.role === 'buyer' ? { buyerId: userId } : { sellerId: userId }),
        ...(query.status ? { status: query.status } : {}),
        ...(cursor ? { id: { lt: cursor.v as string } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: ORDER_INCLUDE,
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((o) => toSummary(o, userId)),
      nextCursor: rows.length > limit ? encodeCursor({ k: 'id', v: page[page.length - 1]!.id }) : null,
    };
  }

  async getDetail(userId: string, orderId: string): Promise<OrderDetailDto> {
    const o = (await this.prisma.order.findFirst({
      where: { id: orderId, OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: DETAIL_INCLUDE,
    })) as OrderWithDetail | null;
    if (!o) throw notFound();
    const role = o.buyerId === userId ? OrderActor.BUYER : OrderActor.SELLER;
    const isBuyer = role === OrderActor.BUYER;
    const onsite = o.listing.workMode === WorkMode.ONSITE;
    const conversation = await this.prisma.conversation.findUnique({
      where: { listingId_buyerId_sellerId: { listingId: o.listingId, buyerId: o.buyerId, sellerId: o.sellerId } },
      select: { id: true },
    });
    const actions = availableOrderActions({ status: o.status, paymentMode: o.paymentMode, changeRequests: o.changeRequests }, role).filter(
      (a): a is UserOrderAction => (USER_ORDER_ACTIONS as readonly string[]).includes(a),
    );

    return {
      ...toSummary(o, userId),
      requirements: o.requirements,
      source: o.quoteId ? 'QUOTE' : 'BOOKING',
      changeRequests: o.changeRequests,
      maxChangeRequests: MAX_CHANGE_REQUESTS,
      availableActions: actions,
      autoApproveAt:
        o.status === OrderStatus.SUBMITTED && o.submittedAt ? new Date(o.submittedAt.getTime() + AUTO_APPROVE_AFTER_DAYS * DAY_MS).toISOString() : null,
      submittedAt: o.submittedAt?.toISOString() ?? null,
      completedAt: o.completedAt?.toISOString() ?? null,
      onsite: {
        required: onsite,
        startedAt: o.startedAt?.toISOString() ?? null,
        startCode: onsite && isBuyer && o.status === OrderStatus.IN_PROGRESS && !o.startedAt ? this.code(o.id, 'start') : null,
        finishCode: onsite && isBuyer && o.status === OrderStatus.IN_PROGRESS && o.startedAt ? this.code(o.id, 'finish') : null,
        canStart: onsite && !isBuyer && o.status === OrderStatus.IN_PROGRESS && !o.startedAt,
      },
      dispute: o.dispute
        ? { reason: o.dispute.reason, status: o.dispute.status, raisedByMe: o.dispute.raisedById === userId, createdAt: o.dispute.createdAt.toISOString() }
        : null,
      conversationId: conversation?.id ?? null,
      timeline: o.events.map((e) => ({
        id: e.id,
        action: e.action,
        actorRole: e.actorId === null ? OrderActor.SYSTEM : e.actorId === o.buyerId ? OrderActor.BUYER : e.actorId === o.sellerId ? OrderActor.SELLER : OrderActor.ADMIN,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async findForParticipant(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: { listing: { select: { workMode: true } } },
    });
    if (!order) throw notFound();
    return order;
  }

  private assertPaymentMode(mode: PaymentMode): void {
    if (mode === PaymentMode.ESCROW && !this.money.escrowEnabled) {
      throw AppError.unprocessable('PAYMENT_MODE_UNAVAILABLE', 'Wallet payments are not available yet — choose "Pay directly"');
    }
  }

  /** 4-digit on-site code for this order (deterministic, never stored). */
  private code(orderId: string, kind: 'start' | 'finish'): string {
    const digest = createHmac('sha256', this.env.CODE_HASH_SECRET).update(`ORDER_${kind.toUpperCase()}:${orderId}`).digest();
    return String(digest.readUInt32BE(0) % 10_000).padStart(4, '0');
  }

  private codeMatches(orderId: string, kind: 'start' | 'finish', code: string): boolean {
    const a = Buffer.from(this.code(orderId, kind));
    const b = Buffer.from(code);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async notifyInChat(order: { listingId: string; buyerId: string; sellerId: string }, senderId: string, text: string) {
    const conversation = await this.conversations.ensure(order.listingId, order.buyerId, order.sellerId);
    await this.conversations.postMessage(conversation, senderId, text);
  }

  private emitUpdate(order: { id: string; status: OrderStatus; buyerId: string; sellerId: string }): void {
    const event: OrderUpdatedEvent = { orderId: order.id, status: order.status };
    this.realtime.emit([userRoom(order.buyerId), userRoom(order.sellerId)], ServerEvent.ORDER_UPDATED, event);
  }
}

function bookingAmount(listing: { pricingType: string; pricePaise: number | null }, input: BookServiceInput): number {
  if (listing.pricingType === PricingType.FIXED) {
    if (input.amountPaise !== undefined || input.hours !== undefined) {
      throw AppError.badRequest('VALIDATION_FAILED', 'This service has a fixed price', [{ path: 'amountPaise', message: 'Not needed for a fixed price' }]);
    }
    return listing.pricePaise!;
  }
  if (listing.pricingType === PricingType.HOURLY) {
    if (!input.hours) throw AppError.badRequest('VALIDATION_FAILED', 'How many hours?', [{ path: 'hours', message: 'Enter the number of hours' }]);
    const total = listing.pricePaise! * input.hours;
    if (total > MAX_AMOUNT_PAISE) throw AppError.badRequest('VALIDATION_FAILED', 'That is too many hours', [{ path: 'hours', message: 'Total is too large' }]);
    return total;
  }
  if (input.amountPaise === undefined) {
    throw AppError.badRequest('VALIDATION_FAILED', 'Enter the price you agreed in chat', [{ path: 'amountPaise', message: 'Enter the agreed price' }]);
  }
  return input.amountPaise;
}

function toSummary(o: OrderWithParties, userId: string): OrderSummaryDto {
  const isBuyer = o.buyerId === userId;
  const other = isBuyer ? o.seller : o.buyer;
  return {
    id: o.id,
    title: o.title,
    status: o.status,
    paymentMode: o.paymentMode,
    amountPaise: o.amountPaise,
    role: isBuyer ? 'BUYER' : 'SELLER',
    other: { id: other.id, displayName: other.profile?.displayName ?? '', avatarUrl: other.profile?.avatarUrl ?? null },
    listing: { id: o.listing.id, workMode: o.listing.workMode },
    deadline: o.deadline ? o.deadline.toISOString().slice(0, 10) : null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}
