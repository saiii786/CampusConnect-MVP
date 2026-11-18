/**
 * Admin-only requests (FR-601). Phase 2: the student-domain allow/deny list (FR-004, PRD Q5).
 */
import { z } from 'zod';

/** A bare domain such as `iith.ac.in` (lower-case, no "@", no scheme). */
export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/, 'Enter a domain like college.ac.in');

/** POST /admin/student-domains — create or update. `allowed: false` blocks a domain even if its suffix is accepted. */
export const upsertStudentDomainSchema = z
  .object({
    domain: domainSchema,
    collegeName: z.string().trim().min(2).max(100),
    allowed: z.boolean().default(true),
  })
  .strict();
export type UpsertStudentDomainInput = z.infer<typeof upsertStudentDomainSchema>;

export interface StudentDomainDto {
  domain: string;
  collegeName: string;
  allowed: boolean;
  createdAt: string;
}
