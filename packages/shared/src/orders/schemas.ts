/**
 * Orders — requests and responses (PRD FR-400…409). The status rules themselves live in
 * ./state-machine.ts; this file only describes what goes over the API.
 */
import { z } from 'zod';
import { OrderStatus, PaymentMode, type WorkMode } from '../enums.js';
import { isValidAmountPaise, MAX_AMOUNT_PAISE } from '../money.js';
import { OrderAction, type OrderActor } from './state-machine.js';

export const ORDER_REQUIREMENTS_MAX = 2000;
export const ORDER_NOTE_MAX = 1000;
export const DISPUTE_REASON_MIN = 10;
export const MAX_BOOKING_HOURS = 200;
export const ONSITE_CODE_LENGTH = 4;

const amountPaise = z
  .number({ error: 'Enter an amount' })
  .refine(isValidAmountPaise, `Enter an amount between ₹1 and ₹${MAX_AMOUNT_PAISE / 100}`);

const futureDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Enter a real date')
  .refine((v) => Date.parse(`${v}T00:00:00Z`) >= Date.now() - 36 * 3600 * 1000, 'The date cannot be in the past');

const requirements = z.string().trim().max(ORDER_REQUIREMENTS_MAX).nullable().optional();

/**
 * POST /orders — book a service offer (FR-400a). The amount comes from the listing:
 * FIXED → its price; HOURLY → price × `hours`; QUOTE → `amountPaise` agreed in chat.
 * The seller then accepts or declines.
 */
export const bookServiceSchema = z
  .object({
    listingId: z.uuid(),
    paymentMode: z.enum(PaymentMode),
    requirements,
    deadline: futureDate.nullable().optional(),
    hours: z.number().int().min(1).max(MAX_BOOKING_HOURS).optional(),
    amountPaise: amountPaise.optional(),
  })
  .strict();
export type BookServiceInput = z.infer<typeof bookServiceSchema>;

/** POST /quotes/:id/accept — the job owner accepts a quote (FR-400b, FR-202). */
export const acceptQuoteSchema = z
  .object({
    paymentMode: z.enum(PaymentMode),
    requirements,
    deadline: futureDate.nullable().optional(),
  })
  .strict();
export type AcceptQuoteInput = z.infer<typeof acceptQuoteSchema>;

/** Actions a buyer or seller may call via POST /orders/:id/actions/:action. */
export const USER_ORDER_ACTIONS = [
  OrderAction.ACCEPT,
  OrderAction.DECLINE,
  OrderAction.CANCEL,
  OrderAction.FUND,
  OrderAction.SUBMIT,
  OrderAction.APPROVE,
  OrderAction.REQUEST_CHANGES,
  OrderAction.DISPUTE,
] as const;
export type UserOrderAction = (typeof USER_ORDER_ACTIONS)[number];
export const userOrderActionSchema = z.enum(USER_ORDER_ACTIONS);

const onsiteCode = z.string().regex(/^\d{4}$/, 'Enter the 4-digit code');

/**
 * Body of POST /orders/:id/actions/:action (all optional; some actions require a field):
 *   - dispute: `reason` (≥ 10 characters) is required;
 *   - submit on an on-site order: `code` = the buyer's finish code is required (FR-406);
 *   - request-changes: `note` explains what to change (recommended).
 */
export const orderActionBodySchema = z.preprocess(
  // Most actions send no body at all (Express then gives `undefined`).
  (v) => v ?? {},
  z
    .object({
      note: z.string().trim().max(ORDER_NOTE_MAX).optional(),
      reason: z
        .string()
        .trim()
        .min(DISPUTE_REASON_MIN, `Explain the problem in at least ${DISPUTE_REASON_MIN} characters`)
        .max(ORDER_NOTE_MAX)
        .optional(),
      code: onsiteCode.optional(),
    })
    .strict(),
);
export type OrderActionBody = z.infer<typeof orderActionBodySchema>;

/** POST /orders/:id/start — seller enters the buyer's 4-digit start code at the job site (FR-406). */
export const startOrderSchema = z.object({ code: onsiteCode }).strict();
export type StartOrderInput = z.infer<typeof startOrderSchema>;

/** GET /orders query string. */
export const listOrdersSchema = z
  .object({
    role: z.enum(['buyer', 'seller']),
    status: z.enum(OrderStatus).optional(),
    cursor: z.string().max(200).optional(),
    limit: z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(v)), z.number().int().min(1).max(50).optional()),
  })
  .strict();
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;

// ── Responses ───────────────────────────────────────────────────────────────

export interface OrderPartyDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface OrderSummaryDto {
  id: string;
  title: string;
  status: OrderStatus;
  paymentMode: PaymentMode;
  amountPaise: number;
  /** My role in this order. */
  role: 'BUYER' | 'SELLER';
  other: OrderPartyDto;
  listing: { id: string; workMode: WorkMode };
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderEventDto {
  id: string;
  action: string;
  actorRole: OrderActor;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface OrderDetailDto extends OrderSummaryDto {
  requirements: string | null;
  source: 'BOOKING' | 'QUOTE';
  changeRequests: number;
  maxChangeRequests: number;
  /** Buttons the viewer may press now (from the shared state machine). */
  availableActions: UserOrderAction[];
  /** When a SUBMITTED order will be approved automatically (FR-407). */
  autoApproveAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  /** On-site check (FR-406). Codes are only ever sent to the BUYER. */
  onsite: {
    required: boolean;
    startedAt: string | null;
    startCode: string | null;
    finishCode: string | null;
    /** Seller must enter the start code before submitting. */
    canStart: boolean;
  };
  dispute: { reason: string; status: string; raisedByMe: boolean; createdAt: string } | null;
  conversationId: string | null;
  timeline: OrderEventDto[];
}

/** Socket event payload for `order:updated`. */
export interface OrderUpdatedEvent {
  orderId: string;
  status: OrderStatus;
}
