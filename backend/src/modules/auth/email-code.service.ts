/**
 * One-time 6-digit email codes for email verification (FR-003) and password reset (FR-006).
 *
 * - Codes are stored as an HMAC (see code-hasher.ts) scoped to "<purpose>:<userId>", so a database
 *   leak alone cannot reveal or brute-force them, and a code only works for its user + purpose.
 * - Each code allows CODE_MAX_ATTEMPTS wrong guesses, then it is dead and a new one must be requested.
 * - Issuing a new code deletes older unused codes of the same purpose (only the latest works).
 * - A user can request at most one code per purpose every CODE_RESEND_COOLDOWN_SECONDS.
 * - Consuming is atomic (`usedAt IS NULL` condition), so a code cannot be used twice.
 */
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import type { EmailTokenPurpose } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CODE_MAX_ATTEMPTS, CODE_RESEND_COOLDOWN_SECONDS, CodeHasher } from './code-hasher.js';

/** Kept for readability at call sites and in tests. */
export const EMAIL_CODE_MAX_ATTEMPTS = CODE_MAX_ATTEMPTS;
export const RESEND_COOLDOWN_SECONDS = CODE_RESEND_COOLDOWN_SECONDS;
export const EMAIL_CODE_TTL_MINUTES: Record<EmailTokenPurpose, number> = {
  VERIFY_EMAIL: 30,
  RESET_PASSWORD: 15,
};

const scopeOf = (purpose: EmailTokenPurpose, userId: string) => `${purpose}:${userId}`;

@Injectable()
export class EmailCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeHasher,
  ) {}

  /**
   * Create a new code and return it in plain text (to be emailed — never logged or returned by the API).
   * Throws 429 AUTH_CODE_COOLDOWN if the previous code is younger than the cooldown.
   */
  async issue(userId: string, purpose: EmailTokenPurpose, now: Date = new Date()): Promise<string> {
    const latest = await this.prisma.emailToken.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (latest && now.getTime() - latest.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
      throw codeCooldown();
    }

    const code = this.codes.generate();
    await this.prisma.$transaction([
      this.prisma.emailToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
      this.prisma.emailToken.create({
        data: {
          userId,
          purpose,
          codeHash: this.codes.hash(scopeOf(purpose, userId), code),
          expiresAt: new Date(now.getTime() + EMAIL_CODE_TTL_MINUTES[purpose] * 60 * 1000),
          createdAt: now,
        },
      }),
    ]);
    return code;
  }

  /**
   * Check and use up a code. Throws 400 AUTH_CODE_INVALID (wrong/no code, with attemptsLeft) or
   * 400 AUTH_CODE_EXPIRED (expired or too many wrong attempts — ask for a new code).
   */
  async consume(userId: string, purpose: EmailTokenPurpose, code: string, now: Date = new Date()): Promise<void> {
    const token = await this.prisma.emailToken.findFirst({
      where: { userId, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) throw invalidCode();
    if (token.expiresAt <= now || token.attempts >= EMAIL_CODE_MAX_ATTEMPTS) throw expiredCode();

    if (!this.codes.matches(token.codeHash, scopeOf(purpose, userId), code)) {
      // Count the failed attempt atomically (concurrent guesses cannot exceed the limit).
      await this.prisma.emailToken.updateMany({
        where: { id: token.id, attempts: { lt: EMAIL_CODE_MAX_ATTEMPTS } },
        data: { attempts: { increment: 1 } },
      });
      const attemptsLeft = Math.max(0, EMAIL_CODE_MAX_ATTEMPTS - token.attempts - 1);
      if (attemptsLeft === 0) throw expiredCode();
      throw invalidCode(attemptsLeft);
    }

    const used = await this.prisma.emailToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: now },
    });
    if (used.count !== 1) throw invalidCode();
  }
}

export function invalidCode(attemptsLeft?: number): AppError {
  return AppError.badRequest(
    'AUTH_CODE_INVALID',
    'That code is not correct',
    attemptsLeft === undefined ? null : { attemptsLeft },
  );
}

export function expiredCode(): AppError {
  return AppError.badRequest('AUTH_CODE_EXPIRED', 'This code has expired. Please request a new one.');
}

export function codeCooldown(): AppError {
  return new AppError('AUTH_CODE_COOLDOWN', 'Please wait a minute before asking for another code', 429, {
    retryAfterSeconds: RESEND_COOLDOWN_SECONDS,
  });
}
