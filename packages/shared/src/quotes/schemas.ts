/**
 * Quotes on job requests — Mode 1 (PRD FR-200…203).
 * A seller sends ONE quote per job request; they can edit or withdraw it while it is ACTIVE.
 * The buyer (job owner) compares quotes with each seller's rating, completed jobs and badges,
 * rejects some and accepts one (accepting creates an order — Phase 5).
 */
import { z } from 'zod';
import type { ListingStatus, QuoteStatus } from '../enums.js';
import { isValidAmountPaise, MAX_AMOUNT_PAISE } from '../money.js';
import type { UserBadge } from '../users/schemas.js';

export const QUOTE_MESSAGE_MIN = 10;
export const QUOTE_MESSAGE_MAX = 1000;

const amountPaise = z
  .number({ error: 'Enter an amount' })
  .refine(isValidAmountPaise, `Enter an amount between ₹1 and ₹${MAX_AMOUNT_PAISE / 100}`);

const etaDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Enter a real date')
  .refine((v) => Date.parse(`${v}T00:00:00Z`) >= Date.now() - 36 * 3600 * 1000, 'The date cannot be in the past');

const message = z
  .string()
  .trim()
  .min(QUOTE_MESSAGE_MIN, `Write at least ${QUOTE_MESSAGE_MIN} characters`)
  .max(QUOTE_MESSAGE_MAX, `At most ${QUOTE_MESSAGE_MAX} characters`);

/** POST /listings/:id/quotes (also re-sends a previously withdrawn quote). */
export const createQuoteSchema = z
  .object({ amountPaise, message, etaDate: etaDate.nullable().optional() })
  .strict();
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

/** PATCH /quotes/:id — only while ACTIVE. */
export const updateQuoteSchema = z
  .object({
    amountPaise: amountPaise.optional(),
    message: message.optional(),
    etaDate: etaDate.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

/** A seller as shown next to their quote (FR-201). */
export interface QuoteSellerDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  badges: UserBadge[];
  rating: { average: number | null; count: number };
  completedJobs: number;
}

export interface QuoteDto {
  id: string;
  listingId: string;
  status: QuoteStatus;
  amountPaise: number;
  message: string;
  etaDate: string | null;
  createdAt: string;
  updatedAt: string;
  seller: QuoteSellerDto;
  /** Conversation between the buyer and this seller about the job (created with the quote). */
  conversationId: string | null;
}

/** GET /me/quotes — my quotes as a seller, with the job they belong to. */
export interface MyQuoteDto extends QuoteDto {
  listing: { id: string; title: string; status: ListingStatus; ownerName: string };
}
