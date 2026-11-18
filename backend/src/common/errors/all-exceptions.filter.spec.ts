import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { AppError } from './app-error.js';
import { toErrorResponse } from './all-exceptions.filter.js';

describe('toErrorResponse', () => {
  it('passes AppError code, status, message and details through', () => {
    const err = AppError.conflict('ORDER_INVALID_TRANSITION', 'Not now', { from: 'REQUESTED' });
    expect(toErrorResponse(err, 'rid-1')).toEqual({
      status: HttpStatus.CONFLICT,
      body: {
        error: {
          code: 'ORDER_INVALID_TRANSITION',
          message: 'Not now',
          details: { from: 'REQUESTED' },
          requestId: 'rid-1',
        },
      },
    });
  });

  it('maps Nest HTTP exceptions to stable codes', () => {
    expect(toErrorResponse(new NotFoundException('Cannot GET /x'), null).body.error.code).toBe('NOT_FOUND');
    expect(toErrorResponse(new BadRequestException('bad'), null).body.error).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'bad',
    });
  });

  it('maps rate limiting to 429 RATE_LIMITED with a friendly message', () => {
    const { status, body } = toErrorResponse(new ThrottlerException(), null);
    expect(status).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.message).toMatch(/too many requests/i);
  });

  it('hides internal details of unexpected errors', () => {
    const { status, body } = toErrorResponse(new Error('connection string postgres://secret@db'), 'rid-2');
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(body.error.requestId).toBe('rid-2');
  });
});
