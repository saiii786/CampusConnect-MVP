import { createHmac } from 'node:crypto';
import { loadEnv } from '../../config/env.js';
import { validateEntries } from '../wallet/ledger.service.js';
import { FakeGateway } from './fake-gateway.js';
import { RazorpayGateway } from './razorpay-gateway.js';

const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  DIRECT_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  CODE_HASH_SECRET: 'b'.repeat(32),
  PAYMENT_GATEWAY: 'razorpay',
  RAZORPAY_KEY_ID: 'rzp_test_key123',
  RAZORPAY_KEY_SECRET: 'secret456',
  RAZORPAY_WEBHOOK_SECRET: 'webhook-secret-789',
  PUBLIC_API_URL: 'https://api.example.com',
});

describe('ledger entry validation', () => {
  it('requires balanced, non-zero, integer entries with the right owner fields', () => {
    expect(() =>
      validateEntries([
        { account: 'EXTERNAL', amountPaise: -500 },
        { account: 'WALLET', userId: 'u', amountPaise: 500 },
      ]),
    ).not.toThrow();
    expect(() => validateEntries([{ account: 'WALLET', userId: 'u', amountPaise: 500 }])).toThrow(/two entries/);
    expect(() =>
      validateEntries([
        { account: 'EXTERNAL', amountPaise: -500 },
        { account: 'WALLET', userId: 'u', amountPaise: 400 },
      ]),
    ).toThrow(/does not balance/);
    expect(() =>
      validateEntries([
        { account: 'EXTERNAL', amountPaise: -1.5 },
        { account: 'WALLET', userId: 'u', amountPaise: 1.5 },
      ]),
    ).toThrow(/integers/);
    expect(() =>
      validateEntries([
        { account: 'ESCROW', amountPaise: 100 },
        { account: 'WALLET', userId: 'u', amountPaise: -100 },
      ]),
    ).toThrow(/orderId/);
  });
});

describe('RazorpayGateway (mocked HTTP)', () => {
  it('creates a payment link with Basic auth, INR amount in paise and a callback URL', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: 'plink_123', short_url: 'https://rzp.io/i/abc', status: 'created' }));
    const gw = new RazorpayGateway(env, fetchImpl as unknown as typeof fetch);
    const session = await gw.createCheckout({ paymentId: '01936b6e-7c3a-7d4e-8f00-0123456789ab', amountPaise: 50_000, description: 'Top-up' });
    expect(session).toEqual({ gatewayRef: 'plink_123', checkoutUrl: 'https://rzp.io/i/abc' });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('https://api.razorpay.com/v1/payment_links');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('rzp_test_key123:secret456').toString('base64')}`);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      amount: 50_000,
      currency: 'INR',
      callback_url: 'https://api.example.com/api/v1/payments/return',
      callback_method: 'get',
    });
    expect(body.reference_id.length).toBeLessThanOrEqual(40);
  });

  it('maps payment link statuses and amounts', async () => {
    const cases: [string, string][] = [
      ['paid', 'paid'],
      ['created', 'pending'],
      ['partially_paid', 'pending'],
      ['expired', 'expired'],
      ['cancelled', 'failed'],
    ];
    for (const [status, state] of cases) {
      const gw = new RazorpayGateway(env, (async () => Response.json({ status, amount_paid: 123 })) as unknown as typeof fetch);
      expect(await gw.fetchStatus('plink_1')).toMatchObject({ state, amountPaidPaise: 123 });
    }
  });

  it('accepts only correctly signed webhooks and extracts the payment link id', () => {
    const gw = new RazorpayGateway(env, fetch);
    const raw = Buffer.from(JSON.stringify({ event: 'payment_link.paid', payload: { payment_link: { entity: { id: 'plink_9' } } } }));
    const good = createHmac('sha256', 'webhook-secret-789').update(raw).digest('hex');
    expect(gw.parseWebhook(raw, { 'x-razorpay-signature': good })).toBe('plink_9');

    const forged = createHmac('sha256', 'wrong-secret').update(raw).digest('hex');
    expect(() => gw.parseWebhook(raw, { 'x-razorpay-signature': forged })).toThrow();
    expect(() => gw.parseWebhook(raw, {})).toThrow();
    // Tampered body with the old signature.
    const tampered = Buffer.from(raw.toString().replace('plink_9', 'plink_X'));
    expect(() => gw.parseWebhook(tampered, { 'x-razorpay-signature': good })).toThrow();

    const other = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: {} }));
    const sig = createHmac('sha256', 'webhook-secret-789').update(other).digest('hex');
    expect(gw.parseWebhook(other, { 'x-razorpay-signature': sig })).toBeNull();
  });
});

describe('FakeGateway', () => {
  it('pending → paid (once); unknown refs are expired', async () => {
    const gw = new FakeGateway();
    const { gatewayRef } = await gw.createCheckout({ paymentId: 'p1', amountPaise: 1000, description: '' });
    expect((await gw.fetchStatus(gatewayRef)).state).toBe('pending');
    gw.complete(gatewayRef, 'paid');
    gw.complete(gatewayRef, 'failed'); // ignored: already final
    expect(await gw.fetchStatus(gatewayRef)).toMatchObject({ state: 'paid', amountPaidPaise: 1000 });
    expect((await gw.fetchStatus('fake_unknown')).state).toBe('expired');
  });
});
