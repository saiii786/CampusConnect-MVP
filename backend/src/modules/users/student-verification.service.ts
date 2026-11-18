/**
 * Student badge (FR-004, PRD Q5): prove you own a college email → profile gets the STUDENT badge.
 *
 * Which emails count (checked in this order, most specific domain first):
 *   1. a StudentDomain row with allowed=false for the domain or a parent domain → refused
 *   2. a StudentDomain row with allowed=true                                       → accepted (+ college name)
 *   3. a built-in suffix: .ac.in, .edu, .edu.in                                     → accepted
 *   otherwise refused.
 * One college email can verify only one account (unique Profile.studentEmail).
 * Codes: 6 digits, HMAC-scoped to user + college email, 30 min, 5 attempts, 60 s resend cooldown.
 */
import { Injectable, Logger } from '@nestjs/common';
import { emailDomain, STUDENT_EMAIL_SUFFIXES, type MeResponse } from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CODE_MAX_ATTEMPTS, CODE_RESEND_COOLDOWN_SECONDS, CodeHasher } from '../auth/code-hasher.js';
import { codeCooldown, expiredCode, invalidCode } from '../auth/email-code.service.js';
import { MailService } from '../mail/mail.service.js';
import { ProfileService } from './profile.service.js';

export const STUDENT_CODE_TTL_MINUTES = 30;

const scopeOf = (userId: string, collegeEmail: string) => `STUDENT:${userId}:${collegeEmail}`;

/** "cse.iith.ac.in" → ["cse.iith.ac.in", "iith.ac.in", "ac.in"] (stops before the top-level domain). */
export function domainCandidates(domain: string): string[] {
  const parts = domain.split('.');
  const out: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) out.push(parts.slice(i).join('.'));
  return out;
}

@Injectable()
export class StudentVerificationService {
  private readonly logger = new Logger('StudentVerification');

  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: CodeHasher,
    private readonly mail: MailService,
    private readonly profiles: ProfileService,
  ) {}

  /** Decide whether an email's domain may get the Student badge. Returns the known college name, if any. */
  async checkDomain(collegeEmail: string): Promise<{ allowed: boolean; collegeName: string | null }> {
    const domain = emailDomain(collegeEmail);
    const candidates = domainCandidates(domain);
    const rows = await this.prisma.studentDomain.findMany({ where: { domain: { in: candidates } } });
    // Most specific domain wins.
    const byDomain = new Map(rows.map((r) => [r.domain, r]));
    for (const candidate of candidates) {
      const row = byDomain.get(candidate);
      if (row) return { allowed: row.allowed, collegeName: row.allowed ? row.collegeName : null };
    }
    const suffixOk = STUDENT_EMAIL_SUFFIXES.some((suffix) => domain.endsWith(suffix));
    return { allowed: suffixOk, collegeName: null };
  }

  /** POST /me/student-verification — email a code to the college address. */
  async start(userId: string, collegeEmail: string, now: Date = new Date()): Promise<MeResponse> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { studentVerifiedAt: true, studentEmail: true },
    });
    if (!profile) throw AppError.notFound();
    if (profile.studentVerifiedAt && profile.studentEmail === collegeEmail) {
      throw AppError.conflict('STUDENT_ALREADY_VERIFIED', 'This college email is already verified');
    }

    const { allowed } = await this.checkDomain(collegeEmail);
    if (!allowed) {
      throw AppError.unprocessable(
        'STUDENT_DOMAIN_NOT_ALLOWED',
        'Use your college email address (for example ending in .ac.in, .edu or .edu.in)',
      );
    }
    await this.assertEmailFree(userId, collegeEmail);

    const pending = await this.prisma.studentVerification.findUnique({ where: { userId } });
    if (pending && now.getTime() - pending.createdAt.getTime() < CODE_RESEND_COOLDOWN_SECONDS * 1000) {
      throw codeCooldown();
    }

    const code = this.codes.generate();
    const data = {
      collegeEmail,
      codeHash: this.codes.hash(scopeOf(userId, collegeEmail), code),
      attempts: 0,
      expiresAt: new Date(now.getTime() + STUDENT_CODE_TTL_MINUTES * 60 * 1000),
      createdAt: now,
    };
    await this.prisma.studentVerification.upsert({ where: { userId }, create: { userId, ...data }, update: data });

    await this.mail.send({
      to: collegeEmail,
      subject: `${code} is your CampusConnect student verification code`,
      text:
        `Use code ${code} to confirm this is your college email and get the Student badge on CampusConnect.\n\n` +
        `It expires in ${STUDENT_CODE_TTL_MINUTES} minutes. If you did not ask for this, ignore this email.`,
    });
    return this.profiles.getMe(userId);
  }

  /** POST /me/student-verification/confirm — check the code and grant the badge. */
  async confirm(userId: string, code: string, now: Date = new Date()): Promise<MeResponse> {
    const pending = await this.prisma.studentVerification.findUnique({ where: { userId } });
    if (!pending) throw invalidCode();
    if (pending.expiresAt <= now || pending.attempts >= CODE_MAX_ATTEMPTS) throw expiredCode();

    if (!this.codes.matches(pending.codeHash, scopeOf(userId, pending.collegeEmail), code)) {
      await this.prisma.studentVerification.updateMany({
        where: { userId, attempts: { lt: CODE_MAX_ATTEMPTS } },
        data: { attempts: { increment: 1 } },
      });
      const attemptsLeft = Math.max(0, CODE_MAX_ATTEMPTS - pending.attempts - 1);
      if (attemptsLeft === 0) throw expiredCode();
      throw invalidCode(attemptsLeft);
    }

    // The domain list may have changed since the code was sent (admin blocked it).
    const { allowed, collegeName } = await this.checkDomain(pending.collegeEmail);
    if (!allowed) {
      await this.prisma.studentVerification.delete({ where: { userId } });
      throw AppError.unprocessable('STUDENT_DOMAIN_NOT_ALLOWED', 'This college email domain is not accepted');
    }
    await this.assertEmailFree(userId, pending.collegeEmail);

    try {
      await this.prisma.$transaction([
        this.prisma.profile.update({
          where: { userId },
          data: {
            studentVerifiedAt: now,
            studentEmail: pending.collegeEmail,
            ...(collegeName ? { collegeName } : {}),
          },
        }),
        this.prisma.studentVerification.delete({ where: { userId } }),
      ]);
    } catch (error) {
      // Another account verified the same college email at the same moment.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw emailInUse();
      throw error;
    }
    this.logger.log(`Student badge granted to user ${userId}`);
    return this.profiles.getMe(userId);
  }

  private async assertEmailFree(userId: string, collegeEmail: string): Promise<void> {
    const other = await this.prisma.profile.findFirst({
      where: { studentEmail: collegeEmail, NOT: { userId } },
      select: { userId: true },
    });
    if (other) throw emailInUse();
  }
}

function emailInUse(): AppError {
  return AppError.conflict('STUDENT_EMAIL_IN_USE', 'This college email is already used by another account');
}
