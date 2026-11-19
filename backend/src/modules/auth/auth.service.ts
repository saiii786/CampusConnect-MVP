/**
 * Account and session logic (FR-001…006). Controllers stay thin; all rules live here.
 *
 * Session model (ADR-017):
 *   - signup/login create a new refresh-token FAMILY (one per device sign-in).
 *   - refresh ROTATES: the presented token is revoked and a new one in the same family is issued.
 *   - REUSE DETECTION: presenting an already-revoked token means it was stolen or replayed →
 *     the whole family is revoked (both the thief and the real user must sign in again).
 *   - logout revokes the family; password reset revokes every family of the user.
 *
 * Account-enumeration stance: login and password-reset never reveal whether an email exists.
 * Signup does return AUTH_EMAIL_TAKEN (needed for usable UX; mitigated by rate limiting).
 */
import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  UserStatus,
  type AuthSessionResponse,
  type LoginInput,
  type MeResponse,
  type ResetPasswordInput,
  type SignupInput,
} from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ME_INCLUDE, toMeResponse, type UserForMe } from '../users/user.mapper.js';
import { EMAIL_CODE_TTL_MINUTES, EmailCodeService } from './email-code.service.js';
import { PasswordHasher } from './password-hasher.js';
import { hashRefreshToken, TokenService } from './token.service.js';

const INVALID_CREDENTIALS = () =>
  AppError.unauthorized('AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect');
const REFRESH_INVALID = () =>
  AppError.unauthorized('AUTH_REFRESH_INVALID', 'Your session has ended. Please sign in again.');
const REFRESH_REUSED = () =>
  AppError.unauthorized('AUTH_REFRESH_REUSED', 'Your session has ended. Please sign in again.');
const SUSPENDED = () =>
  AppError.forbidden('AUTH_ACCOUNT_SUSPENDED', 'Your account is suspended. Contact support.');

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly codes: EmailCodeService,
    private readonly mail: MailService,
    private readonly realtime: RealtimeService,
  ) {}

  /** FR-001/005: create the account (+ profile + empty wallet), sign in, email a verification code. */
  async signup(input: SignupInput): Promise<AuthSessionResponse> {
    const passwordHash = await this.passwords.hash(input.password);
    let user: UserForMe;
    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
          dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
          termsAcceptedAt: new Date(),
          profile: { create: { displayName: input.displayName, skills: [], languages: [] } },
          wallet: { create: {} },
        },
        include: ME_INCLUDE,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.conflict('AUTH_EMAIL_TAKEN', 'An account with this email already exists');
      }
      throw error;
    }

    await this.sendCodeSafely(user.id, user.email, 'VERIFY_EMAIL');
    return this.startSession(user);
  }

  /** FR-001: sign in. Same error and similar timing whether the email or the password is wrong. */
  async login(input: LoginInput): Promise<AuthSessionResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: ME_INCLUDE,
    });
    if (!user || user.status === UserStatus.DELETED) {
      await this.passwords.verifyDummy(input.password);
      throw INVALID_CREDENTIALS();
    }
    if (!(await this.passwords.verify(user.passwordHash, input.password))) throw INVALID_CREDENTIALS();
    // Only reveal suspension to someone who knows the password.
    if (user.status === UserStatus.SUSPENDED) throw SUSPENDED();
    return this.startSession(user);
  }

  /** FR-002: exchange a refresh token for a new access + refresh token (rotation, reuse detection). */
  async refresh(refreshToken: string, now: Date = new Date()): Promise<AuthSessionResponse> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      include: { user: { include: ME_INCLUDE } },
    });
    if (!existing) throw REFRESH_INVALID();

    if (existing.revokedAt) {
      await this.revokeFamily(existing.familyId, now);
      this.logger.warn(`Refresh token reuse detected; family revoked (user ${existing.userId})`);
      throw REFRESH_REUSED();
    }
    if (existing.expiresAt <= now) throw REFRESH_INVALID();
    if (existing.user.status !== UserStatus.ACTIVE) {
      await this.revokeFamily(existing.familyId, now);
      throw existing.user.status === UserStatus.SUSPENDED ? SUSPENDED() : REFRESH_INVALID();
    }

    const next = this.tokens.newRefreshToken(now);
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Claim the old token atomically: two concurrent refreshes cannot both succeed.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (claimed.count !== 1) return false;
      const created = await tx.refreshToken.create({
        data: { userId: existing.userId, tokenHash: next.hash, familyId: existing.familyId, expiresAt: next.expiresAt },
      });
      await tx.refreshToken.update({ where: { id: existing.id }, data: { replacedById: created.id } });
      return true;
    });
    if (!rotated) {
      // Lost the race to another refresh with the same token → treat as reuse.
      await this.revokeFamily(existing.familyId, now);
      throw REFRESH_REUSED();
    }

    const access = await this.tokens.signAccessToken(existing.userId, now);
    return {
      user: toMeResponse(existing.user),
      tokens: {
        accessToken: access.token,
        accessTokenExpiresAt: access.expiresAt.toISOString(),
        refreshToken: next.token,
        refreshTokenExpiresAt: next.expiresAt.toISOString(),
      },
    };
  }

  /** FR-002: sign out this device. Idempotent; unknown tokens are ignored. */
  async logout(refreshToken: string): Promise<void> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      select: { familyId: true },
    });
    if (existing) await this.revokeFamily(existing.familyId, new Date());
  }

  /** FR-003: confirm the email with the 6-digit code. */
  async verifyEmail(userId: string, code: string): Promise<MeResponse> {
    const user = await this.getUser(userId);
    if (user.emailVerifiedAt) {
      throw AppError.conflict('AUTH_EMAIL_ALREADY_VERIFIED', 'Your email is already verified');
    }
    await this.codes.consume(userId, 'VERIFY_EMAIL', code);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
      include: ME_INCLUDE,
    });
    return toMeResponse(updated);
  }

  /** FR-003: send a fresh verification code (cooldown applies). */
  async resendVerification(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (user.emailVerifiedAt) {
      throw AppError.conflict('AUTH_EMAIL_ALREADY_VERIFIED', 'Your email is already verified');
    }
    const code = await this.codes.issue(userId, 'VERIFY_EMAIL');
    await this.mail.send(verificationEmail(user.email, code));
  }

  /** FR-006: always "accepted", whether or not the email has an account (no enumeration). */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, status: true } });
    if (!user || user.status !== UserStatus.ACTIVE) return;
    await this.sendCodeSafely(user.id, user.email, 'RESET_PASSWORD');
  }

  /** FR-006: set a new password with the emailed code; signs out every device. */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true, status: true } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw AppError.badRequest('AUTH_CODE_INVALID', 'That code is not correct');
    }
    await this.codes.consume(user.id, 'RESET_PASSWORD', input.code);
    const passwordHash = await this.passwords.hash(input.newPassword);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      // Receiving the code proves the user controls the inbox → the email counts as verified.
      this.prisma.user.updateMany({
        where: { id: user.id, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
    // Close live sockets opened with old tokens; the real user's app reconnects after signing in again.
    this.realtime.disconnectUser(user.id);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async startSession(user: UserForMe): Promise<AuthSessionResponse> {
    const now = new Date();
    const access = await this.tokens.signAccessToken(user.id, now);
    const refresh = this.tokens.newRefreshToken(now);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: refresh.hash, familyId: randomUUID(), expiresAt: refresh.expiresAt },
    });
    return {
      user: toMeResponse(user),
      tokens: {
        accessToken: access.token,
        accessTokenExpiresAt: access.expiresAt.toISOString(),
        refreshToken: refresh.token,
        refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
      },
    };
  }

  private async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } });
  }

  private async getUser(userId: string): Promise<UserForMe> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: ME_INCLUDE });
    if (!user) throw AppError.notFound();
    return user;
  }

  /**
   * Issue + email a code without failing the caller's main action (e.g. signup still succeeds
   * if the email provider hiccups or the cooldown is active; the user can press "resend").
   */
  private async sendCodeSafely(userId: string, email: string, purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD'): Promise<void> {
    try {
      const code = await this.codes.issue(userId, purpose);
      await this.mail.send(purpose === 'VERIFY_EMAIL' ? verificationEmail(email, code) : resetEmail(email, code));
    } catch (error) {
      if (error instanceof AppError && error.code === 'AUTH_CODE_COOLDOWN') return;
      this.logger.error(`Could not send ${purpose} email to user ${userId}: ${(error as Error).message}`);
    }
  }
}

function verificationEmail(to: string, code: string) {
  return {
    to,
    subject: `${code} is your Connect verification code`,
    text:
      `Your Connect verification code is ${code}.\n\n` +
      `It expires in ${EMAIL_CODE_TTL_MINUTES.VERIFY_EMAIL} minutes. If you did not sign up, ignore this email.`,
  };
}

function resetEmail(to: string, code: string) {
  return {
    to,
    subject: `${code} is your Connect password reset code`,
    text:
      `Use code ${code} to reset your Connect password.\n\n` +
      `It expires in ${EMAIL_CODE_TTL_MINUTES.RESET_PASSWORD} minutes. If you did not ask for this, ignore this email — ` +
      `your password has not changed.`,
  };
}
