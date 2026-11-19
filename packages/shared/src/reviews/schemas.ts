/**
 * Reviews (PRD FR-500…502) and the public verified work record (FR-053).
 * Reviews exist only for orders COMPLETED in the app; both sides may review once, within
 * REVIEW_WINDOW_DAYS of completion; the reviewed person may post one public reply.
 */
import { z } from 'zod';

export const REVIEW_WINDOW_DAYS = 14;
export const REVIEW_COMMENT_MAX = 1000;

/** POST /orders/:id/review */
export const createReviewSchema = z
  .object({
    rating: z.number().int().min(1, 'Choose 1 to 5 stars').max(5, 'Choose 1 to 5 stars'),
    comment: z
      .string()
      .trim()
      .max(REVIEW_COMMENT_MAX)
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .strict();
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/** POST /reviews/:id/reply */
export const replyReviewSchema = z
  .object({ reply: z.string().trim().min(1, 'Write a reply').max(REVIEW_COMMENT_MAX) })
  .strict();
export type ReplyReviewInput = z.infer<typeof replyReviewSchema>;

export interface ReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  reviewer: { id: string; displayName: string; avatarUrl: string | null };
  /** What the reviewer was in the order: a BUYER reviewing the seller, or a SELLER reviewing the buyer. */
  reviewerRole: 'BUYER' | 'SELLER';
  orderTitle: string;
}

/** Review state shown on an order. */
export interface OrderReviewsDto {
  mine: ReviewDto | null;
  theirs: ReviewDto | null;
  canReview: boolean;
  /** Last moment a review can be left (completedAt + 14 days), or null if not completed. */
  reviewDeadline: string | null;
}

/** One completed job on the public work record (no names, no contact details). */
export interface WorkRecordEntryDto {
  orderId: string;
  category: string;
  /** "2026-11" — month of completion. */
  completedMonth: string;
  /** Rating the buyer gave (null if they did not review). */
  rating: number | null;
  /** The buyer's comment, if any. */
  comment: string | null;
  /** True when the buyer paid through the app (escrow); false for "pay directly" orders (ADR-027 L2). */
  paidInApp: boolean;
}

/** GET /users/:id/work-record (public) — FR-053. */
export interface WorkRecordDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  collegeName: string | null;
  isStudent: boolean;
  memberSince: string;
  completedJobs: number;
  rating: { average: number | null; count: number };
  entries: WorkRecordEntryDto[];
}
