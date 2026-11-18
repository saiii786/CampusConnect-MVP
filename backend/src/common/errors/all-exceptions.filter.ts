/**
 * Global exception filter: every error leaves the API in ONE shape (docs/ARCHITECTURE.md §8):
 *
 *   { "error": { "code": "...", "message": "...", "details": ..., "requestId": "..." } }
 *
 * - AppError            → its own code/status/message/details.
 * - Nest HttpException  → code derived from the status (e.g. 404 → NOT_FOUND, 429 → RATE_LIMITED).
 * - anything else       → 500 INTERNAL_ERROR with a generic message; the real error and stack
 *                         are logged server-side only (never sent to clients).
 */
import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { getRequestId } from '../http/request-context.middleware.js';
import { AppError } from './app-error.js';

export interface ErrorBody {
  error: { code: string; message: string; details: unknown; requestId: string | null };
}

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'AUTH_REQUIRED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

/** Convert any thrown value into status + body. Exported for unit tests. */
export function toErrorResponse(
  exception: unknown,
  requestId: string | null,
): { status: number; body: ErrorBody } {
  if (exception instanceof AppError) {
    return {
      status: exception.status,
      body: {
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details ?? null,
          requestId,
        },
      },
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code = CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
    // Only expose Nest's message for client errors; 5xx messages may contain internals.
    const message =
      status < 500 ? readHttpExceptionMessage(exception) : 'Something went wrong. Please try again.';
    return { status, body: { error: { code, message, details: null, requestId } } };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
        details: null,
        requestId,
      },
    },
  };
}

function readHttpExceptionMessage(exception: HttpException): string {
  if (exception.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  const message = (response as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map(String).join('; ');
  return exception.message;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    // Only HTTP is handled here; websocket errors are handled in the realtime gateway.
    if (host.getType() !== 'http') throw exception;

    const res = host.switchToHttp().getResponse<Response>();
    const requestId = getRequestId(res) ?? null;
    const { status, body } = toErrorResponse(exception, requestId);

    if (status >= 500) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(`rid=${requestId} ${err.name}: ${err.message}`, err.stack);
    }

    if (res.headersSent) return;
    res.status(status).json(body);
  }
}
