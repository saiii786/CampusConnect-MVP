/**
 * Razorpay TEST-mode gateway using hosted Payment Links (ADR-024). Keys must be `rzp_test_…`
 * (enforced by env.ts) — no real money can move.
 *
 *   create : POST https://api.razorpay.com/v1/payment_links   (Basic auth key_id:key_secret)
 *            { amount, currency: 'INR', description, reference_id, callback_url?, callback_method: 'get' }
 *            → { id: 'plink_…', short_url, status }
 *   status : GET  https://api.razorpay.com/v1/payment_links/:id → { status: created|partially_paid|paid|expired|cancelled, amount_paid }
 *   webhook: header X-Razorpay-Signature = hex HMAC-SHA256(raw body, webhook secret); we only read
 *            the payment link id from the payload and then ask Razorpay for the status ourselves.
 *
 * ⚠ Built against Razorpay's docs (checked 2026-11-18) and unit-tested with a mocked HTTP layer;
 *   NOT yet verified against a real test account (needs the founder's test keys) — see DEV_LOG.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';
import { PaymentGateway, type CheckoutRequest, type CheckoutSession, type GatewayStatus } from './payment-gateway.js';

const API = 'https://api.razorpay.com/v1';
export const RAZORPAY_FETCH = Symbol('RAZORPAY_FETCH');

@Injectable()
export class RazorpayGateway extends PaymentGateway {
  readonly name = 'razorpay' as const;
  private readonly logger = new Logger('Razorpay');
  private readonly auth: string;
  private readonly webhookSecret: string;
  private readonly callbackUrl: string | null;

  constructor(
    @Inject(APP_ENV) env: AppEnv,
    @Inject(RAZORPAY_FETCH) private readonly fetchImpl: typeof fetch,
  ) {
    super();
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.RAZORPAY_WEBHOOK_SECRET) {
      throw new Error('Razorpay is not configured'); // env.ts already prevents this
    }
    this.auth = `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;
    this.webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
    this.callbackUrl = env.PUBLIC_API_URL ? `${env.PUBLIC_API_URL.replace(/\/+$/, '')}/api/v1/payments/return` : null;
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const res = await this.fetchImpl(`${API}/payment_links`, {
      method: 'POST',
      headers: { Authorization: this.auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: request.amountPaise,
        currency: 'INR',
        description: request.description,
        reference_id: request.paymentId.replace(/-/g, '').slice(0, 40),
        notes: { paymentId: request.paymentId },
        ...(this.callbackUrl ? { callback_url: this.callbackUrl, callback_method: 'get' } : {}),
      }),
    });
    if (!res.ok) {
      this.logger.error(`create payment link failed: HTTP ${res.status}`);
      throw new Error(`Razorpay create failed (${res.status})`);
    }
    const data = (await res.json()) as { id?: unknown; short_url?: unknown };
    if (typeof data.id !== 'string' || typeof data.short_url !== 'string') throw new Error('Unexpected Razorpay response');
    return { gatewayRef: data.id, checkoutUrl: data.short_url };
  }

  async fetchStatus(gatewayRef: string): Promise<GatewayStatus> {
    const res = await this.fetchImpl(`${API}/payment_links/${encodeURIComponent(gatewayRef)}`, {
      headers: { Authorization: this.auth },
    });
    if (!res.ok) throw new Error(`Razorpay status failed (${res.status})`);
    const data = (await res.json()) as { status?: string; amount_paid?: number };
    const state =
      data.status === 'paid' ? 'paid' : data.status === 'expired' ? 'expired' : data.status === 'cancelled' ? 'failed' : 'pending';
    return { state, amountPaidPaise: typeof data.amount_paid === 'number' ? data.amount_paid : 0, raw: data };
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): string | null {
    const signature = headers['x-razorpay-signature'];
    if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) throw new Error('missing signature');
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('bad signature');

    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      payload?: { payment_link?: { entity?: { id?: unknown } } };
    };
    if (!event.event?.startsWith('payment_link.')) return null;
    const id = event.payload?.payment_link?.entity?.id;
    return typeof id === 'string' ? id : null;
  }
}
