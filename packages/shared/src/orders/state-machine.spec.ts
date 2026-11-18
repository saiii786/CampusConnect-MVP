/**
 * Tests for the order state machine.
 *
 * EXPECTED below is written independently from the implementation, copied from the table
 * in docs/ARCHITECTURE.md §6. The exhaustive test checks every (status × action × actor ×
 * payment mode) combination, so any rule added, removed or changed without updating the
 * documented table makes this test fail.
 */
import { OrderStatus, PaymentMode } from '../enums.js';
import {
  AUTO_APPROVE_AFTER_DAYS,
  MAX_CHANGE_REQUESTS,
  MoneyEffect,
  OrderAction,
  OrderActor,
  OrderSource,
  TransitionErrorCode,
  availableOrderActions,
  initialOrderStatus,
  isTerminalOrderStatus,
  resolveOrderTransition,
  type OrderRuleContext,
} from './state-machine.js';

type Row = {
  from: OrderStatus;
  action: OrderAction;
  actor: OrderActor;
  /** Expected target per payment mode. */
  to: { ESCROW: OrderStatus; DIRECT: OrderStatus };
  /** Expected money effect for ESCROW orders (DIRECT is always null). */
  money: MoneyEffect | null;
};

const S = OrderStatus;
const A = OrderAction;
const { BUYER, SELLER, ADMIN, SYSTEM } = OrderActor;
const same = (s: OrderStatus) => ({ ESCROW: s, DIRECT: s });

// ── docs/ARCHITECTURE.md §6, row by row ─────────────────────────────────────────────
const EXPECTED: Row[] = [
  { from: S.REQUESTED, action: A.ACCEPT, actor: SELLER, to: { ESCROW: S.AWAITING_PAYMENT, DIRECT: S.IN_PROGRESS }, money: null },
  { from: S.REQUESTED, action: A.DECLINE, actor: SELLER, to: same(S.DECLINED), money: null },
  { from: S.REQUESTED, action: A.CANCEL, actor: BUYER, to: same(S.CANCELLED), money: null },
  { from: S.AWAITING_PAYMENT, action: A.FUND, actor: BUYER, to: same(S.IN_PROGRESS), money: MoneyEffect.HOLD },
  { from: S.AWAITING_PAYMENT, action: A.CANCEL, actor: BUYER, to: same(S.CANCELLED), money: null },
  { from: S.AWAITING_PAYMENT, action: A.CANCEL, actor: SELLER, to: same(S.CANCELLED), money: null },
  { from: S.IN_PROGRESS, action: A.SUBMIT, actor: SELLER, to: same(S.SUBMITTED), money: null },
  { from: S.IN_PROGRESS, action: A.CANCEL, actor: SELLER, to: same(S.CANCELLED), money: MoneyEffect.REFUND },
  { from: S.SUBMITTED, action: A.APPROVE, actor: BUYER, to: same(S.COMPLETED), money: MoneyEffect.RELEASE },
  { from: S.SUBMITTED, action: A.REQUEST_CHANGES, actor: BUYER, to: same(S.IN_PROGRESS), money: null },
  { from: S.SUBMITTED, action: A.AUTO_APPROVE, actor: SYSTEM, to: same(S.COMPLETED), money: MoneyEffect.RELEASE },
  { from: S.IN_PROGRESS, action: A.DISPUTE, actor: BUYER, to: same(S.DISPUTED), money: null },
  { from: S.IN_PROGRESS, action: A.DISPUTE, actor: SELLER, to: same(S.DISPUTED), money: null },
  { from: S.SUBMITTED, action: A.DISPUTE, actor: BUYER, to: same(S.DISPUTED), money: null },
  { from: S.SUBMITTED, action: A.DISPUTE, actor: SELLER, to: same(S.DISPUTED), money: null },
  { from: S.DISPUTED, action: A.RESOLVE_REFUND, actor: ADMIN, to: same(S.CANCELLED), money: MoneyEffect.REFUND },
  { from: S.DISPUTED, action: A.RESOLVE_RELEASE, actor: ADMIN, to: same(S.COMPLETED), money: MoneyEffect.RELEASE },
];

const ALL_STATUSES = Object.values(OrderStatus);
const ALL_ACTIONS = Object.values(OrderAction);
const ALL_ACTORS = Object.values(OrderActor);
const ALL_MODES = Object.values(PaymentMode);

const ctx = (status: OrderStatus, paymentMode: PaymentMode, changeRequests = 0): OrderRuleContext => ({
  status,
  paymentMode,
  changeRequests,
});

describe('resolveOrderTransition', () => {
  it('matches the documented table for every status × action × actor × payment mode', () => {
    let checked = 0;
    for (const status of ALL_STATUSES)
      for (const action of ALL_ACTIONS)
        for (const actor of ALL_ACTORS)
          for (const mode of ALL_MODES) {
            const row = EXPECTED.find((r) => r.from === status && r.action === action && r.actor === actor);
            const result = resolveOrderTransition(ctx(status, mode), action, actor);
            const label = `${status} --${action}(${actor}, ${mode})-->`;
            if (row) {
              expect(result, label).toEqual({
                ok: true,
                to: row.to[mode],
                moneyEffect: mode === PaymentMode.ESCROW ? row.money : null,
              });
            } else {
              expect(result.ok, `${label} should be rejected`).toBe(false);
            }
            checked++;
          }
    expect(checked).toBe(ALL_STATUSES.length * ALL_ACTIONS.length * ALL_ACTORS.length * ALL_MODES.length);
  });

  it('distinguishes "wrong state" from "wrong person"', () => {
    const wrongState = resolveOrderTransition(ctx(S.REQUESTED, PaymentMode.ESCROW), A.APPROVE, BUYER);
    expect(wrongState).toMatchObject({ ok: false, code: TransitionErrorCode.INVALID_TRANSITION });

    const wrongActor = resolveOrderTransition(ctx(S.SUBMITTED, PaymentMode.ESCROW), A.APPROVE, SELLER);
    expect(wrongActor).toMatchObject({ ok: false, code: TransitionErrorCode.NOT_ALLOWED_FOR_ACTOR });
  });

  it('buyer cannot cancel once work has started (must dispute instead)', () => {
    const result = resolveOrderTransition(ctx(S.IN_PROGRESS, PaymentMode.ESCROW), A.CANCEL, BUYER);
    expect(result).toMatchObject({ ok: false, code: TransitionErrorCode.NOT_ALLOWED_FOR_ACTOR });
  });

  it(`allows at most ${MAX_CHANGE_REQUESTS} change requests`, () => {
    for (let n = 0; n < MAX_CHANGE_REQUESTS; n++) {
      expect(resolveOrderTransition(ctx(S.SUBMITTED, PaymentMode.DIRECT, n), A.REQUEST_CHANGES, BUYER).ok).toBe(true);
    }
    const blocked = resolveOrderTransition(
      ctx(S.SUBMITTED, PaymentMode.DIRECT, MAX_CHANGE_REQUESTS),
      A.REQUEST_CHANGES,
      BUYER,
    );
    expect(blocked).toMatchObject({ ok: false, code: TransitionErrorCode.RULE_VIOLATION });
  });

  it('nothing can leave a terminal state', () => {
    for (const status of [S.COMPLETED, S.CANCELLED, S.DECLINED])
      for (const action of ALL_ACTIONS)
        for (const actor of ALL_ACTORS)
          expect(resolveOrderTransition(ctx(status, PaymentMode.ESCROW), action, actor).ok).toBe(false);
  });
});

describe('availableOrderActions', () => {
  it('shows the seller accept/decline on a new booking, and the buyer only cancel', () => {
    const c = ctx(S.REQUESTED, PaymentMode.ESCROW);
    expect(availableOrderActions(c, SELLER).sort()).toEqual([A.ACCEPT, A.DECLINE].sort());
    expect(availableOrderActions(c, BUYER)).toEqual([A.CANCEL]);
  });

  it('hides request-changes once the limit is reached', () => {
    const c = ctx(S.SUBMITTED, PaymentMode.ESCROW, MAX_CHANGE_REQUESTS);
    expect(availableOrderActions(c, BUYER).sort()).toEqual([A.APPROVE, A.DISPUTE].sort());
  });

  it('offers nothing in terminal states', () => {
    for (const actor of ALL_ACTORS) {
      expect(availableOrderActions(ctx(S.COMPLETED, PaymentMode.ESCROW), actor)).toEqual([]);
    }
  });
});

describe('initialOrderStatus and helpers', () => {
  it('booking waits for the seller; accepted quotes skip straight ahead', () => {
    expect(initialOrderStatus(OrderSource.BOOKING, PaymentMode.ESCROW)).toBe(S.REQUESTED);
    expect(initialOrderStatus(OrderSource.BOOKING, PaymentMode.DIRECT)).toBe(S.REQUESTED);
    expect(initialOrderStatus(OrderSource.QUOTE, PaymentMode.ESCROW)).toBe(S.AWAITING_PAYMENT);
    expect(initialOrderStatus(OrderSource.QUOTE, PaymentMode.DIRECT)).toBe(S.IN_PROGRESS);
  });

  it('marks exactly COMPLETED, CANCELLED and DECLINED as terminal', () => {
    const terminal = ALL_STATUSES.filter(isTerminalOrderStatus).sort();
    expect(terminal).toEqual([S.CANCELLED, S.COMPLETED, S.DECLINED].sort());
  });

  it('exposes the documented business constants', () => {
    expect(MAX_CHANGE_REQUESTS).toBe(3);
    expect(AUTO_APPROVE_AFTER_DAYS).toBe(5);
  });
});
