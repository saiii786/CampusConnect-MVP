/**
 * Payment gateway abstraction (ARCHITECTURE §7, ADR-024). Feature code only talks to this.
 *   - FakeGateway:     built-in fake checkout page (dev/tests).
 *   - RazorpayGateway: Razorpay TEST mode hosted Payment Links (real checkout UI, fake money).
 */
export interface CheckoutRequest {
  /** Our Payment id (sent to the gateway as reference). */
  paymentId: string;
  amountPaise: number;
  description: string;
}

export interface CheckoutSession {
  /** Gateway's id for this checkout (unique). */
  gatewayRef: string;
  /** Absolute URL, or "/…" relative to the API origin (fake gateway). */
  checkoutUrl: string;
}

export type GatewayPaymentState = 'pending' | 'paid' | 'failed' | 'expired';

export interface GatewayStatus {
  state: GatewayPaymentState;
  /** How much the gateway says was paid (paise). Credited only if it equals our amount. */
  amountPaidPaise: number;
  raw: unknown;
}

export abstract class PaymentGateway {
  abstract readonly name: 'fake' | 'razorpay';
  abstract createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /** Ask the gateway directly (server-to-server). Never trust the app to say "paid". */
  abstract fetchStatus(gatewayRef: string): Promise<GatewayStatus>;
  /**
   * Verify a webhook (signature over the RAW body). Returns the gateway ref it is about, or null
   * if the event is irrelevant. Throws if the signature is invalid.
   */
  abstract parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): string | null;
}
