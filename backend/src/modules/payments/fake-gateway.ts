/**
 * Fake gateway for development and tests (PAYMENT_GATEWAY=fake; refused in production).
 * Its "checkout" is a simple page served by this API (FakeCheckoutController) with Pay / Cancel
 * buttons. State lives in memory (fine for one dev server; restarting forgets unpaid checkouts).
 */
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PaymentGateway, type CheckoutRequest, type CheckoutSession, type GatewayPaymentState, type GatewayStatus } from './payment-gateway.js';

@Injectable()
export class FakeGateway extends PaymentGateway {
  readonly name = 'fake' as const;
  private readonly checkouts = new Map<string, { amountPaise: number; state: GatewayPaymentState }>();

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const gatewayRef = `fake_${randomUUID()}`;
    this.checkouts.set(gatewayRef, { amountPaise: request.amountPaise, state: 'pending' });
    // The checkout URL is completed with a signed token by PaymentsService.
    return { gatewayRef, checkoutUrl: `/api/v1/payments/fake/${request.paymentId}` };
  }

  async fetchStatus(gatewayRef: string): Promise<GatewayStatus> {
    const c = this.checkouts.get(gatewayRef);
    if (!c) return { state: 'expired', amountPaidPaise: 0, raw: { gatewayRef, note: 'unknown (server restarted?)' } };
    return { state: c.state, amountPaidPaise: c.state === 'paid' ? c.amountPaise : 0, raw: { gatewayRef, ...c } };
  }

  /** Called by the fake checkout page buttons. */
  complete(gatewayRef: string, outcome: 'paid' | 'failed'): void {
    const c = this.checkouts.get(gatewayRef);
    if (c && c.state === 'pending') c.state = outcome;
  }

  parseWebhook(): string | null {
    return null; // the fake gateway has no webhooks; the page completes payments directly
  }
}
