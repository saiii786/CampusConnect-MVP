/**
 * Domain enums shared by backend and mobile.
 *
 * Each enum is a `const` object (usable at runtime, e.g. in zod `z.enum(...)`)
 * plus a matching string-union type. Values MUST stay identical to the enums in
 * backend/prisma/schema.prisma — a backend unit test checks this.
 *
 * Reference: docs/ARCHITECTURE.md §5 (data model).
 */

/** Values of a const-object enum as a tuple, for z.enum(). */
export function enumValues<T extends Record<string, string>>(e: T): [T[keyof T], ...T[keyof T][]] {
  return Object.values(e) as [T[keyof T], ...T[keyof T][]];
}

export const UserRole = { USER: 'USER', ADMIN: 'ADMIN' } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = { ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED', DELETED: 'DELETED' } as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

/** The four ways to match (PRD §6). AVAILABLE_NOW / NEED_NOW are v1.1 (FR-300). */
export const ListingType = {
  SERVICE_OFFER: 'SERVICE_OFFER',
  JOB_REQUEST: 'JOB_REQUEST',
  AVAILABLE_NOW: 'AVAILABLE_NOW',
  NEED_NOW: 'NEED_NOW',
} as const;
export type ListingType = (typeof ListingType)[keyof typeof ListingType];

export const ListingStatus = { ACTIVE: 'ACTIVE', PAUSED: 'PAUSED', CLOSED: 'CLOSED' } as const;
export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

export const PricingType = { FIXED: 'FIXED', HOURLY: 'HOURLY', QUOTE: 'QUOTE' } as const;
export type PricingType = (typeof PricingType)[keyof typeof PricingType];

export const WorkMode = { REMOTE: 'REMOTE', ONSITE: 'ONSITE' } as const;
export type WorkMode = (typeof WorkMode)[keyof typeof WorkMode];

export const QuoteStatus = {
  ACTIVE: 'ACTIVE',
  WITHDRAWN: 'WITHDRAWN',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  NOT_SELECTED: 'NOT_SELECTED',
} as const;
export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];

export const PaymentMode = { ESCROW: 'ESCROW', DIRECT: 'DIRECT' } as const;
export type PaymentMode = (typeof PaymentMode)[keyof typeof PaymentMode];

/** Order lifecycle states — see orders/state-machine.ts and ARCHITECTURE §6. */
export const OrderStatus = {
  REQUESTED: 'REQUESTED',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DECLINED: 'DECLINED',
  DISPUTED: 'DISPUTED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const DisputeStatus = {
  OPEN: 'OPEN',
  RESOLVED_REFUND: 'RESOLVED_REFUND',
  RESOLVED_RELEASE: 'RESOLVED_RELEASE',
} as const;
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

export const LedgerTransactionKind = {
  TOPUP: 'TOPUP',
  ESCROW_HOLD: 'ESCROW_HOLD',
  ESCROW_RELEASE: 'ESCROW_RELEASE',
  ESCROW_REFUND: 'ESCROW_REFUND',
  WITHDRAWAL: 'WITHDRAWAL',
} as const;
export type LedgerTransactionKind = (typeof LedgerTransactionKind)[keyof typeof LedgerTransactionKind];

export const LedgerAccount = { WALLET: 'WALLET', ESCROW: 'ESCROW', EXTERNAL: 'EXTERNAL' } as const;
export type LedgerAccount = (typeof LedgerAccount)[keyof typeof LedgerAccount];

export const PaymentStatus = {
  CREATED: 'CREATED',
  PAID: 'PAID',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const ReportTargetType = {
  USER: 'USER',
  LISTING: 'LISTING',
  MESSAGE: 'MESSAGE',
  REVIEW: 'REVIEW',
} as const;
export type ReportTargetType = (typeof ReportTargetType)[keyof typeof ReportTargetType];

export const ReportStatus = { OPEN: 'OPEN', ACTIONED: 'ACTIONED', DISMISSED: 'DISMISSED' } as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];
