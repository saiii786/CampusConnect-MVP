/**
 * Order state machine — the ONE definition of how an order may move between states.
 *
 * Used by:
 *  - backend `OrdersService.transition()` to accept or reject every status change (FR-401);
 *  - mobile app to decide which action buttons to show.
 *
 * Specification: docs/ARCHITECTURE.md §6 and ADR-012. If you change a rule here,
 * update that table and add an ADR entry — this is product behaviour, not an implementation detail.
 */
import { OrderStatus, PaymentMode } from '../enums.js';

/** Who is performing an action on an order. */
export const OrderActor = {
  BUYER: 'BUYER',
  SELLER: 'SELLER',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
} as const;
export type OrderActor = (typeof OrderActor)[keyof typeof OrderActor];

/**
 * Actions that change an order's status. Values are kebab-case because they
 * appear in the API path: `POST /orders/:id/actions/:action`.
 */
export const OrderAction = {
  ACCEPT: 'accept',
  DECLINE: 'decline',
  CANCEL: 'cancel',
  FUND: 'fund',
  SUBMIT: 'submit',
  APPROVE: 'approve',
  REQUEST_CHANGES: 'request-changes',
  DISPUTE: 'dispute',
  AUTO_APPROVE: 'auto-approve',
  RESOLVE_REFUND: 'resolve-refund',
  RESOLVE_RELEASE: 'resolve-release',
} as const;
export type OrderAction = (typeof OrderAction)[keyof typeof OrderAction];

/** What must happen to escrowed money as part of a transition (ESCROW orders only). */
export const MoneyEffect = {
  /** Buyer wallet → order escrow (full order amount). */
  HOLD: 'HOLD',
  /** Order escrow → seller wallet. */
  RELEASE: 'RELEASE',
  /** Order escrow → buyer wallet. */
  REFUND: 'REFUND',
} as const;
export type MoneyEffect = (typeof MoneyEffect)[keyof typeof MoneyEffect];

/** Business constants (PRD FR-404, FR-407). */
export const MAX_CHANGE_REQUESTS = 3;
export const AUTO_APPROVE_AFTER_DAYS = 5;

/** The minimum an order must expose for the rules to be evaluated. */
export interface OrderRuleContext {
  status: OrderStatus;
  paymentMode: PaymentMode;
  /** How many times the buyer has already requested changes. */
  changeRequests: number;
}

interface TransitionRule {
  action: OrderAction;
  from: readonly OrderStatus[];
  actors: readonly OrderActor[];
  /** Target status; may depend on the order (e.g. payment mode). */
  to: (ctx: OrderRuleContext) => OrderStatus;
  /** Money movement for ESCROW orders, if any. Never applied to DIRECT orders. */
  money?: MoneyEffect;
  /** Extra business check; returns an error message when the action is not allowed. */
  guard?: (ctx: OrderRuleContext) => string | null;
}

const to = (status: OrderStatus) => () => status;
const afterAgreement = (ctx: OrderRuleContext): OrderStatus =>
  ctx.paymentMode === PaymentMode.ESCROW ? OrderStatus.AWAITING_PAYMENT : OrderStatus.IN_PROGRESS;

const { BUYER, SELLER, ADMIN, SYSTEM } = OrderActor;
const S = OrderStatus;

/** The rule table. Mirrors docs/ARCHITECTURE.md §6 row by row. */
const RULES: readonly TransitionRule[] = [
  { action: OrderAction.ACCEPT, from: [S.REQUESTED], actors: [SELLER], to: afterAgreement },
  { action: OrderAction.DECLINE, from: [S.REQUESTED], actors: [SELLER], to: to(S.DECLINED) },
  { action: OrderAction.CANCEL, from: [S.REQUESTED], actors: [BUYER], to: to(S.CANCELLED) },
  { action: OrderAction.CANCEL, from: [S.AWAITING_PAYMENT], actors: [BUYER, SELLER], to: to(S.CANCELLED) },
  // After work has started only the seller may back out; the buyer gets a full refund (ADR-012).
  {
    action: OrderAction.CANCEL,
    from: [S.IN_PROGRESS],
    actors: [SELLER],
    to: to(S.CANCELLED),
    money: MoneyEffect.REFUND,
  },
  {
    action: OrderAction.FUND,
    from: [S.AWAITING_PAYMENT],
    actors: [BUYER],
    to: to(S.IN_PROGRESS),
    money: MoneyEffect.HOLD,
  },
  { action: OrderAction.SUBMIT, from: [S.IN_PROGRESS], actors: [SELLER], to: to(S.SUBMITTED) },
  {
    action: OrderAction.APPROVE,
    from: [S.SUBMITTED],
    actors: [BUYER],
    to: to(S.COMPLETED),
    money: MoneyEffect.RELEASE,
  },
  {
    action: OrderAction.REQUEST_CHANGES,
    from: [S.SUBMITTED],
    actors: [BUYER],
    to: to(S.IN_PROGRESS),
    guard: (ctx) =>
      ctx.changeRequests >= MAX_CHANGE_REQUESTS
        ? `Changes can be requested at most ${MAX_CHANGE_REQUESTS} times`
        : null,
  },
  {
    action: OrderAction.AUTO_APPROVE,
    from: [S.SUBMITTED],
    actors: [SYSTEM],
    to: to(S.COMPLETED),
    money: MoneyEffect.RELEASE,
  },
  {
    action: OrderAction.DISPUTE,
    from: [S.IN_PROGRESS, S.SUBMITTED],
    actors: [BUYER, SELLER],
    to: to(S.DISPUTED),
  },
  {
    action: OrderAction.RESOLVE_REFUND,
    from: [S.DISPUTED],
    actors: [ADMIN],
    to: to(S.CANCELLED),
    money: MoneyEffect.REFUND,
  },
  {
    action: OrderAction.RESOLVE_RELEASE,
    from: [S.DISPUTED],
    actors: [ADMIN],
    to: to(S.COMPLETED),
    money: MoneyEffect.RELEASE,
  },
];

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  S.COMPLETED,
  S.CANCELLED,
  S.DECLINED,
];

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TERMINAL_ORDER_STATUSES.includes(status);
}

/** Error codes returned when a transition is rejected (also used as API error codes). */
export const TransitionErrorCode = {
  INVALID_TRANSITION: 'ORDER_INVALID_TRANSITION',
  NOT_ALLOWED_FOR_ACTOR: 'ORDER_ACTION_NOT_ALLOWED',
  RULE_VIOLATION: 'ORDER_RULE_VIOLATION',
} as const;
export type TransitionErrorCode = (typeof TransitionErrorCode)[keyof typeof TransitionErrorCode];

export type TransitionResult =
  | { ok: true; to: OrderStatus; moneyEffect: MoneyEffect | null }
  | { ok: false; code: TransitionErrorCode; message: string };

/**
 * Decide whether `actor` may perform `action` on an order in its current state.
 * Pure function: does not change anything. The backend applies the result
 * (status update + money movement) inside one database transaction.
 */
export function resolveOrderTransition(
  ctx: OrderRuleContext,
  action: OrderAction,
  actor: OrderActor,
): TransitionResult {
  const candidates = RULES.filter((r) => r.action === action && r.from.includes(ctx.status));
  if (candidates.length === 0) {
    return {
      ok: false,
      code: TransitionErrorCode.INVALID_TRANSITION,
      message: `Action '${action}' is not possible while the order is ${ctx.status}`,
    };
  }
  const rule = candidates.find((r) => r.actors.includes(actor));
  if (!rule) {
    return {
      ok: false,
      code: TransitionErrorCode.NOT_ALLOWED_FOR_ACTOR,
      message: `Action '${action}' is not allowed for the ${actor.toLowerCase()} while the order is ${ctx.status}`,
    };
  }
  const violation = rule.guard?.(ctx) ?? null;
  if (violation) {
    return { ok: false, code: TransitionErrorCode.RULE_VIOLATION, message: violation };
  }
  const moneyEffect =
    rule.money && ctx.paymentMode === PaymentMode.ESCROW ? rule.money : null;
  return { ok: true, to: rule.to(ctx), moneyEffect };
}

/**
 * Actions `actor` can currently take — used by the app to show buttons.
 * Excludes actions whose guard currently fails.
 */
export function availableOrderActions(ctx: OrderRuleContext, actor: OrderActor): OrderAction[] {
  const actions = new Set<OrderAction>();
  for (const rule of RULES) {
    if (!rule.from.includes(ctx.status) || !rule.actors.includes(actor)) continue;
    if (rule.guard?.(ctx)) continue;
    actions.add(rule.action);
  }
  return [...actions];
}

/** How an order comes into existence (FR-400). */
export const OrderSource = { BOOKING: 'BOOKING', QUOTE: 'QUOTE' } as const;
export type OrderSource = (typeof OrderSource)[keyof typeof OrderSource];

/**
 * Starting status of a new order.
 * - Booking a service: the seller still has to accept → REQUESTED.
 * - Accepting a quote: the seller already agreed by quoting → straight to payment / work.
 */
export function initialOrderStatus(source: OrderSource, paymentMode: PaymentMode): OrderStatus {
  if (source === OrderSource.BOOKING) return S.REQUESTED;
  return paymentMode === PaymentMode.ESCROW ? S.AWAITING_PAYMENT : S.IN_PROGRESS;
}
