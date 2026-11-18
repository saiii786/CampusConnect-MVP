/**
 * Application errors with a stable, machine-readable `code`.
 *
 * Services throw these for expected problems ("not found", "not allowed", "invalid state").
 * The global exception filter turns them into the standard error response
 * (docs/ARCHITECTURE.md §8):
 *
 *   { "error": { "code": "...", "message": "...", "details": ..., "requestId": "..." } }
 *
 * Codes are UPPER_SNAKE_CASE, prefixed by area (AUTH_, ORDER_, WALLET_...). The mobile app
 * may branch on `code`, so never rename an existing code.
 */
import { HttpStatus } from '@nestjs/common';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: HttpStatus,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(code: string, message: string, details?: unknown) {
    return new AppError(code, message, HttpStatus.BAD_REQUEST, details);
  }
  static unauthorized(code = 'AUTH_REQUIRED', message = 'You need to sign in') {
    return new AppError(code, message, HttpStatus.UNAUTHORIZED);
  }
  static forbidden(code = 'FORBIDDEN', message = 'You are not allowed to do this') {
    return new AppError(code, message, HttpStatus.FORBIDDEN);
  }
  /** Also used when a resource exists but the caller must not learn that (avoids ID probing). */
  static notFound(code = 'NOT_FOUND', message = 'Not found') {
    return new AppError(code, message, HttpStatus.NOT_FOUND);
  }
  static conflict(code: string, message: string, details?: unknown) {
    return new AppError(code, message, HttpStatus.CONFLICT, details);
  }
  static unprocessable(code: string, message: string, details?: unknown) {
    return new AppError(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

/** Shape of one validation problem in `error.details` for VALIDATION_FAILED. */
export interface ValidationIssue {
  /** Dotted path to the field, e.g. "items.0.price". Empty string = the whole value. */
  path: string;
  message: string;
}
