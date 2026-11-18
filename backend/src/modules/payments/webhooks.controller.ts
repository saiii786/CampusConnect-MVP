/**
 * POST /api/v1/webhooks/razorpay — public (no JWT); authenticity is proven by the
 * X-Razorpay-Signature HMAC over the RAW body (app created with `rawBody: true`).
 * Always answers 200 for valid signatures (even unknown events) so Razorpay stops retrying.
 */
import { Controller, HttpCode, HttpStatus, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { Public } from '../auth/auth.decorators.js';
import { PaymentsService } from './payments.service.js';

@Public()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  async razorpay(@Req() req: RawBodyRequest<Request>): Promise<{ received: true }> {
    if (!req.rawBody) throw AppError.badRequest('BAD_REQUEST', 'Missing body');
    await this.payments.handleWebhook(req.rawBody, req.headers);
    return { received: true };
  }
}
