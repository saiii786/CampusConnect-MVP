/**
 * Safety: reports (FR-600) and admin moderation (FR-601). Blocks live in conversations/schemas.ts.
 */
import { z } from 'zod';
import type { ReportStatus, ReportTargetType } from '../enums.js';

export const ReportReason = {
  SPAM: 'SPAM',
  SCAM: 'SCAM',
  ABUSE: 'ABUSE',
  INAPPROPRIATE: 'INAPPROPRIATE',
  FAKE_PROFILE: 'FAKE_PROFILE',
  SAFETY: 'SAFETY',
  OTHER: 'OTHER',
} as const;
export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason];

export const REPORT_DETAILS_MAX = 1000;

/** POST /reports */
export const createReportSchema = z
  .object({
    targetType: z.enum(['USER', 'LISTING', 'MESSAGE', 'REVIEW']),
    targetId: z.uuid(),
    reason: z.enum(ReportReason),
    details: z.string().trim().max(REPORT_DETAILS_MAX).optional(),
  })
  .strict();
export type CreateReportInput = z.infer<typeof createReportSchema>;

export interface ReportDto {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
}

/** Admin view: the report plus a short description of what was reported. */
export interface AdminReportDto extends ReportDto {
  reporter: { id: string; displayName: string };
  target: { summary: string; ownerId: string | null };
  handledAt: string | null;
}

/** GET /admin/reports query */
export const adminReportsQuerySchema = z
  .object({ status: z.enum(['OPEN', 'ACTIONED', 'DISMISSED']).optional() })
  .strict();
export type AdminReportsQuery = z.infer<typeof adminReportsQuerySchema>;

/**
 * POST /admin/reports/:id/resolve
 *   DISMISS — nothing wrong;
 *   ACTION  — hide the reported content (listing closed+removed, message/review hidden) and/or
 *             suspend the person responsible.
 */
export const resolveReportSchema = z
  .object({
    decision: z.enum(['DISMISS', 'ACTION']),
    hideContent: z.boolean().default(false),
    suspendUser: z.boolean().default(false),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

/** POST /admin/users/:id/suspend */
export const suspendUserSchema = z.object({ reason: z.string().trim().min(5).max(500) }).strict();
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;

/** POST /admin/disputes/:orderId/resolve */
export const resolveDisputeSchema = z
  .object({
    resolution: z.enum(['REFUND', 'RELEASE']),
    note: z.string().trim().min(5, 'Explain the decision').max(1000),
  })
  .strict();
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

export interface AdminDisputeDto {
  orderId: string;
  orderTitle: string;
  amountPaise: number;
  paymentMode: string;
  orderStatus: string;
  reason: string;
  status: string;
  raisedBy: { id: string; displayName: string; role: 'BUYER' | 'SELLER' };
  buyer: { id: string; displayName: string };
  seller: { id: string; displayName: string };
  createdAt: string;
}
