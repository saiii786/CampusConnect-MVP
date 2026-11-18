/**
 * Session tokens (FR-002, ADR-017).
 *
 * Access token — a short-lived JWT (HS256, default 15 min) sent as `Authorization: Bearer …`.
 *   Claims: sub (user id), typ "access", iss, aud, iat, exp. The algorithm, issuer and audience
 *   are pinned on verification, so `alg: none` or tokens from elsewhere are rejected.
 *   The user's role/status are NOT trusted from the token; the auth guard reads them from the
 *   database on every request, so suspensions take effect immediately.
 *
 * Refresh token — 32 random bytes (base64url), NOT a JWT. Only its SHA-256 hash is stored, so a
 *   database leak does not expose usable tokens. Rotation + reuse detection live in AuthService.
 */
import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import { AppError } from '../../common/errors/app-error.js';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';

export const JWT_ISSUER = 'campusconnect-api';
export const JWT_AUDIENCE = 'campusconnect-app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class TokenService {
  private readonly accessKey: Uint8Array;

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {
    this.accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  }

  async signAccessToken(userId: string, now: Date = new Date()): Promise<IssuedToken> {
    const iat = Math.floor(now.getTime() / 1000);
    const exp = iat + this.env.ACCESS_TOKEN_TTL_MINUTES * 60;
    const token = await new SignJWT({ typ: 'access' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(this.accessKey);
    return { token, expiresAt: new Date(exp * 1000) };
  }

  /**
   * Returns the user id from a valid access token. Throws 401 AUTH_TOKEN_INVALID for anything
   * else (bad signature, expired, wrong algorithm/issuer/audience/type, malformed).
   * The mobile app reacts to 401 by refreshing once, then signing out.
   */
  async verifyAccessToken(token: string): Promise<{ userId: string }> {
    try {
      const { payload } = await jwtVerify(token, this.accessKey, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        requiredClaims: ['sub', 'exp', 'iat'],
      });
      if (payload.typ !== 'access' || typeof payload.sub !== 'string' || !UUID.test(payload.sub)) {
        throw new Error('unexpected token claims');
      }
      return { userId: payload.sub };
    } catch (error) {
      const expired = error instanceof joseErrors.JWTExpired;
      throw AppError.unauthorized(
        'AUTH_TOKEN_INVALID',
        expired ? 'Your session has expired' : 'Your session is not valid. Please sign in again.',
      );
    }
  }

  /** A new random refresh token and the hash to store. */
  newRefreshToken(now: Date = new Date()): IssuedToken & { hash: string } {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    return { token, hash: hashRefreshToken(token), expiresAt };
  }
}
