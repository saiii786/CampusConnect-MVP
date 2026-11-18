/**
 * Payments module: gateway selection (PAYMENT_GATEWAY), top-ups, webhook, fake checkout pages.
 */
import { Module } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';
import { LedgerModule } from '../wallet/ledger.module.js';
import { FakeCheckoutController } from './fake-checkout.controller.js';
import { FakeGateway } from './fake-gateway.js';
import { PaymentGateway } from './payment-gateway.js';
import { PaymentsService } from './payments.service.js';
import { RAZORPAY_FETCH, RazorpayGateway } from './razorpay-gateway.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  imports: [LedgerModule],
  controllers: [WebhooksController, FakeCheckoutController],
  providers: [
    PaymentsService,
    { provide: RAZORPAY_FETCH, useValue: (...args: Parameters<typeof fetch>) => fetch(...args) },
    {
      provide: PaymentGateway,
      inject: [APP_ENV, RAZORPAY_FETCH],
      useFactory: (env: AppEnv, fetchImpl: typeof fetch): PaymentGateway =>
        env.PAYMENT_GATEWAY === 'razorpay' ? new RazorpayGateway(env, fetchImpl) : new FakeGateway(),
    },
  ],
  exports: [PaymentsService, PaymentGateway],
})
export class PaymentsModule {}
