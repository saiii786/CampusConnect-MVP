/**
 * Auth request schemas and response types (PRD FR-001…006, ARCHITECTURE §8.1).
 *
 * Used by BOTH sides:
 *   - backend: `@Body({ schema: signupSchema })` validates every request;
 *   - mobile: the same schemas drive form validation, so the app and the server
 *     can never disagree about what a valid email/password/date of birth is.
 *
 * Every object schema is `.strict()`: unknown fields are rejected (mass-assignment guard).
 */
import { z } from 'zod';
import type { UserRole } from '../enums.js';

export const PASSWORD_MIN_LENGTH = 8;
/** Upper bound protects the server from hashing megabyte-long "passwords". */
export const PASSWORD_MAX_LENGTH = 128;
export const MIN_SIGNUP_AGE_YEARS = 18;
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 50;
/** One-time codes (email verification, password reset) are 6 digits. */
export const EMAIL_CODE_LENGTH = 6;

/** Trimmed, lower-cased email. Lower-casing makes `A@x.com` and `a@x.com` the same account. */
export const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'));

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .refine((p) => p.trim().length > 0, 'Password cannot be only spaces');

export const emailCodeSchema = z
  .string({ error: 'Code is required' })
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code');

export const displayNameSchema = z
  .string({ error: 'Name is required' })
  .trim()
  .min(DISPLAY_NAME_MIN, `Name must be at least ${DISPLAY_NAME_MIN} characters`)
  .max(DISPLAY_NAME_MAX, `Name must be at most ${DISPLAY_NAME_MAX} characters`);

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses `YYYY-MM-DD` into its parts; returns null for malformed or impossible dates (e.g. 2001-02-30). */
export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const m = ISO_DATE.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/**
 * Whole years between a `YYYY-MM-DD` birth date and `today` (UTC calendar date).
 * Returns null for an invalid date. Someone born 2008-11-18 is 18 on 2026-11-18.
 */
export function ageInYears(dateOfBirth: string, today: Date = new Date()): number | null {
  const dob = parseIsoDate(dateOfBirth);
  if (!dob) return null;
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1;
  const d = today.getUTCDate();
  let age = y - dob.year;
  if (m < dob.month || (m === dob.month && d < dob.day)) age -= 1;
  return age;
}

export const dateOfBirthSchema = z
  .string({ error: 'Date of birth is required' })
  .trim()
  .refine((v) => parseIsoDate(v) !== null, 'Use the format YYYY-MM-DD')
  .refine((v) => {
    const age = ageInYears(v);
    return age === null || age >= MIN_SIGNUP_AGE_YEARS;
  }, `You must be at least ${MIN_SIGNUP_AGE_YEARS} to use CampusConnect`)
  .refine((v) => {
    const age = ageInYears(v);
    return age === null || age <= 120;
  }, 'Enter your real date of birth');

// ── Requests ────────────────────────────────────────────────────────────────

/** POST /auth/signup (FR-001, FR-005, FR-604). */
export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: displayNameSchema,
    dateOfBirth: dateOfBirthSchema,
    /** Must be literally `true`: the user ticked "I accept the terms, privacy policy and guidelines". */
    acceptTerms: z.literal(true, { error: 'You must accept the terms to continue' }),
  })
  .strict();
export type SignupInput = z.infer<typeof signupSchema>;

/** POST /auth/login. Password is not length-checked here so old/short passwords give the generic error. */
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(PASSWORD_MAX_LENGTH),
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

/** POST /auth/refresh and POST /auth/logout. */
export const refreshTokenSchema = z
  .object({ refreshToken: z.string().min(20).max(200) })
  .strict();
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

/** POST /auth/verify-email (signed in). */
export const verifyEmailSchema = z.object({ code: emailCodeSchema }).strict();
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** POST /auth/forgot-password. */
export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** POST /auth/reset-password. */
export const resetPasswordSchema = z
  .object({ email: emailSchema, code: emailCodeSchema, newPassword: passwordSchema })
  .strict();
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ── Responses ───────────────────────────────────────────────────────────────

/** The signed-in user's own account (GET /me). Never returned for OTHER users — they get PublicUser. */
export interface MeResponse {
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  displayName: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  /** ISO-8601 UTC. The app refreshes shortly before this. */
  accessTokenExpiresAt: string;
  /** Opaque; single use — every refresh returns a new one (rotation). */
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

/** Response of signup, login and refresh. */
export interface AuthSessionResponse {
  user: MeResponse;
  tokens: AuthTokens;
}

/** Stable error codes returned by auth endpoints (the app branches on these). */
export const AuthErrorCode = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  AUTH_ACCOUNT_SUSPENDED: 'AUTH_ACCOUNT_SUSPENDED',
  AUTH_REFRESH_INVALID: 'AUTH_REFRESH_INVALID',
  AUTH_REFRESH_REUSED: 'AUTH_REFRESH_REUSED',
  AUTH_CODE_INVALID: 'AUTH_CODE_INVALID',
  AUTH_CODE_EXPIRED: 'AUTH_CODE_EXPIRED',
  AUTH_CODE_COOLDOWN: 'AUTH_CODE_COOLDOWN',
  AUTH_EMAIL_ALREADY_VERIFIED: 'AUTH_EMAIL_ALREADY_VERIFIED',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
} as const;
export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];
