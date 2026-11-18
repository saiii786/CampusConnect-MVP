/**
 * Wallet, escrow and test-mode payments (PRD FR-450…456, ARCHITECTURE §7). Everything is in
 * integer paise. TEST MODE: no real money ever moves (ADR-004).
 */
import { z } from 'zod';
import type { LedgerTransactionKind, PaymentStatus } from '../enums.js';

/** Smallest / largest single top-up: ₹10 … ₹50,000. */
export const TOPUP_MIN_PAISE = 10_00;
export const TOPUP_MAX_PAISE = 50_000_00;
/** Smallest simulated withdrawal: ₹10. */
export const WITHDRAWAL_MIN_PAISE = 10_00;
/** Platform fee during the pilot (FR-456): 0 basis points. */
export const PLATFORM_FEE_BPS = 0;

const intPaise = (min: number, max: number, what: string) =>
  z
    .number({ error: 'Enter an amount' })
    .int('Use whole paise')
    .min(min, `${what} must be at least ₹${min / 100}`)
    .max(max, `${what} can be at most ₹${max / 100}`);

/** POST /wallet/topups */
export const createTopupSchema = z.object({ amountPaise: intPaise(TOPUP_MIN_PAISE, TOPUP_MAX_PAISE, 'Amount') }).strict();
export type CreateTopupInput = z.infer<typeof createTopupSchema>;

/** POST /wallet/withdrawals (simulated). */
export const createWithdrawalSchema = z
  .object({ amountPaise: intPaise(WITHDRAWAL_MIN_PAISE, 10_00_000_00, 'Withdrawal') })
  .strict();
export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;

export interface WalletDto {
  balancePaise: number;
  /** Money I paid into escrow for orders that are not finished yet. */
  inEscrowPaise: number;
  /** Always true in the MVP — show the TEST MODE badge (FR-455). */
  testMode: true;
}

export interface WalletTransactionDto {
  id: string;
  kind: LedgerTransactionKind;
  /** Signed: + money in, − money out of my wallet. */
  amountPaise: number;
  description: string | null;
  orderId: string | null;
  createdAt: string;
}

export interface TopupDto {
  id: string;
  amountPaise: number;
  status: PaymentStatus;
  /** Absolute URL (Razorpay) or a path starting with "/" relative to the API origin (fake gateway). */
  checkoutUrl: string;
  gateway: 'fake' | 'razorpay';
  createdAt: string;
}

export interface WithdrawalDto {
  id: string;
  amountPaise: number;
  status: 'SIMULATED';
  createdAt: string;
}

/** GET /admin/ledger/reconcile */
export interface LedgerReconcileDto {
  walletsChecked: number;
  walletMismatches: { userId: string; cachedPaise: number; ledgerPaise: number }[];
  unbalancedTransactions: string[];
  /** Finished orders that still hold escrow money (should be none). */
  strandedEscrow: { orderId: string; status: string; heldPaise: number }[];
  ok: boolean;
}
