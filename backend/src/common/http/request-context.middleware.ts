/**
 * Runs first for every HTTP request:
 *  1. assigns a request ID (reuses a safe incoming `x-request-id`, otherwise a new UUID),
 *     returns it in the `x-request-id` response header and stores it in `res.locals.requestId`
 *     so error responses and logs can reference it (NFR-09);
 *  2. writes one access-log line when the response finishes: method, path, status, duration.
 *
 * Never logs bodies, query strings or headers — they can contain passwords or tokens.
 */
import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function getRequestId(res: Response): string | undefined {
  return res.locals?.requestId as string | undefined;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      const path = req.originalUrl.split('?')[0];
      const line = `${req.method} ${path} ${res.statusCode} ${ms.toFixed(1)}ms rid=${requestId}`;
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });

    next();
  }
}
