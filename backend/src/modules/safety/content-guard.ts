/**
 * Basic spam / scam guard (FR-603) for user-written text in listings, quotes and messages.
 * Refuses (422 CONTENT_NOT_ALLOWED):
 *   - known scam phrases (blocked-terms.ts) — e.g. asking for a "registration fee" or an OTP;
 *   - link spam: more than MAX_LINKS web links in one text;
 *   - floods: the same character repeated 30+ times.
 * Deliberately simple and explainable; reports + admin review handle the rest.
 */
import { AppError } from '../../common/errors/app-error.js';
import { BLOCKED_PHRASES } from './blocked-terms.js';

export const MAX_LINKS = 3;
const LINK = /(https?:\/\/|www\.)\S+/gi;
const FLOOD = /(.)\1{29,}/;

/** Returns a reason string if the text is not allowed, otherwise null. Exported for tests. */
export function findContentProblem(text: string): string | null {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  const phrase = BLOCKED_PHRASES.find((p) => normalized.includes(p));
  if (phrase) return `Asking for "${phrase}" is not allowed on Connect (common scam). Keep all payments in the app.`;
  if ((text.match(LINK) ?? []).length > MAX_LINKS) return `Too many links (max ${MAX_LINKS})`;
  if (FLOOD.test(text)) return 'Please remove the repeated characters';
  return null;
}

/** Throws 422 CONTENT_NOT_ALLOWED if any of the texts is not allowed. */
export function assertContentAllowed(...texts: (string | null | undefined)[]): void {
  for (const text of texts) {
    if (!text) continue;
    const problem = findContentProblem(text);
    if (problem) throw AppError.unprocessable('CONTENT_NOT_ALLOWED', problem);
  }
}

/** Per-user rate limits for content creation (multi-instance safe: counted in the database). */
export const MESSAGE_LIMIT_PER_MINUTE = 30;
export const LISTING_LIMIT_PER_HOUR = 10;

export function tooManyRequests(what: string): AppError {
  return new AppError('RATE_LIMITED', `You are sending ${what} too quickly. Please wait a little and try again.`, 429);
}
