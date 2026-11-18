/**
 * Profiles, student badge, portfolio and account deletion (PRD FR-004, FR-009, FR-050…054).
 * Request schemas are used by the API and by the app's forms; response types describe exactly
 * what the API returns.
 */
import { z } from 'zod';
import { displayNameSchema, emailCodeSchema, emailSchema, PASSWORD_MAX_LENGTH } from '../auth/schemas.js';
import type { UserRole } from '../enums.js';
import { uploadKeySchema } from '../uploads/schemas.js';

export const BIO_MAX = 500;
export const CITY_MAX = 60;
export const COLLEGE_NAME_MAX = 100;
export const TAG_MAX_LENGTH = 30;
export const SKILLS_MAX = 15;
export const LANGUAGES_MAX = 10;
export const PORTFOLIO_MAX_ITEMS = 10;
export const PORTFOLIO_TITLE_MAX = 80;
export const PORTFOLIO_DESCRIPTION_MAX = 500;

/** Optional text that may be cleared: "" or null → null. */
const clearableText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .nullable()
    .transform((v) => (v === '' ? null : v));

/** Tag list (skills, languages): trimmed, blanks dropped, duplicates (case-insensitive) removed. */
const tagList = (maxItems: number, label: string) =>
  z
    .array(z.string().trim().max(TAG_MAX_LENGTH, `Each ${label} must be at most ${TAG_MAX_LENGTH} characters`))
    .transform((tags) => {
      const seen = new Set<string>();
      return tags.filter((t) => {
        const k = t.toLowerCase();
        if (!t || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    })
    .pipe(z.array(z.string()).max(maxItems, `At most ${maxItems} ${label}s`));

// ── Profile ─────────────────────────────────────────────────────────────────

/** PATCH /me — send only the fields that change. `avatarUploadKey: null` removes the photo. */
export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    bio: clearableText(BIO_MAX, 'Bio').optional(),
    city: clearableText(CITY_MAX, 'City').optional(),
    collegeName: clearableText(COLLEGE_NAME_MAX, 'College name').optional(),
    skills: tagList(SKILLS_MAX, 'skill').optional(),
    languages: tagList(LANGUAGES_MAX, 'language').optional(),
    avatarUploadKey: uploadKeySchema.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** DELETE /me — the password is asked again before deleting (FR-009). */
export const deleteAccountSchema = z
  .object({ password: z.string().min(1, 'Password is required').max(PASSWORD_MAX_LENGTH) })
  .strict();
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

// ── Student badge (FR-004) ──────────────────────────────────────────────────

/** Built-in college email suffixes (PRD Q5). Admins can allow more domains or block some. */
export const STUDENT_EMAIL_SUFFIXES = ['.ac.in', '.edu', '.edu.in'] as const;

/** POST /me/student-verification */
export const startStudentVerificationSchema = z.object({ collegeEmail: emailSchema }).strict();
export type StartStudentVerificationInput = z.infer<typeof startStudentVerificationSchema>;

/** POST /me/student-verification/confirm */
export const confirmStudentVerificationSchema = z.object({ code: emailCodeSchema }).strict();
export type ConfirmStudentVerificationInput = z.infer<typeof confirmStudentVerificationSchema>;

/** Lower-cased domain part of an email ("a@CSE.IITH.ac.in" → "cse.iith.ac.in"). */
export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

// ── Portfolio (FR-051) ──────────────────────────────────────────────────────

export const createPortfolioItemSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(PORTFOLIO_TITLE_MAX),
    description: clearableText(PORTFOLIO_DESCRIPTION_MAX, 'Description').optional(),
    uploadKey: uploadKeySchema,
  })
  .strict();
export type CreatePortfolioItemInput = z.infer<typeof createPortfolioItemSchema>;

export const updatePortfolioItemSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(PORTFOLIO_TITLE_MAX).optional(),
    description: clearableText(PORTFOLIO_DESCRIPTION_MAX, 'Description').optional(),
    position: z.number().int().min(0).max(PORTFOLIO_MAX_ITEMS - 1).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdatePortfolioItemInput = z.infer<typeof updatePortfolioItemSchema>;

/** Route parameter ids (`/users/:id`, `/me/portfolio/:id`). */
export const idParamSchema = z.uuid('Invalid id');

// ── Responses ───────────────────────────────────────────────────────────────

export const UserBadge = { STUDENT: 'STUDENT', EMAIL_VERIFIED: 'EMAIL_VERIFIED' } as const;
export type UserBadge = (typeof UserBadge)[keyof typeof UserBadge];

export interface OwnProfile {
  displayName: string;
  /** Absolute URL, or "/…" relative to the API origin (local dev storage). */
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  collegeName: string | null;
  skills: string[];
  languages: string[];
}

export interface StudentStatus {
  verified: boolean;
  /** The verified college email (only ever shown to its owner). */
  collegeEmail: string | null;
  /** A college email waiting for its code. */
  pendingEmail: string | null;
}

/** The signed-in user's own account (GET /me, PATCH /me, auth responses). Never sent for other users. */
export interface MeResponse {
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  createdAt: string;
  profile: OwnProfile;
  student: StudentStatus;
}

export interface PortfolioItemDto {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  position: number;
}

/** Another user's profile (GET /users/:id). Never contains email, phone or exact location (FR-054). */
export interface PublicProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  collegeName: string | null;
  skills: string[];
  languages: string[];
  badges: UserBadge[];
  memberSince: string;
  rating: { average: number | null; count: number };
  completedJobs: number;
  portfolio: PortfolioItemDto[];
}
