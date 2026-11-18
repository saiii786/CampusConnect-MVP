/**
 * One-time 6-digit codes: generation, storage hash and constant-time comparison.
 * Used for email verification / password reset (EmailCodeService) and the student badge
 * (StudentVerificationService).
 *
 * Hash = HMAC-SHA256(CODE_HASH_SECRET, "<scope>:<code>"). The `scope` binds a code to its use,
 * e.g. "VERIFY_EMAIL:<userId>" or "STUDENT:<userId>:<collegeEmail>", so a code issued for one
 * purpose, user or email can never be used for another.
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';

export const CODE_MAX_ATTEMPTS = 5;
export const CODE_RESEND_COOLDOWN_SECONDS = 60;

@Injectable()
export class CodeHasher {
  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  /** A uniformly random 6-digit code (leading zeros allowed). */
  generate(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  hash(scope: string, code: string): string {
    return createHmac('sha256', this.env.CODE_HASH_SECRET).update(`${scope}:${code}`).digest('hex');
  }

  matches(storedHash: string, scope: string, code: string): boolean {
    const expected = Buffer.from(storedHash, 'hex');
    const actual = Buffer.from(this.hash(scope, code), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
