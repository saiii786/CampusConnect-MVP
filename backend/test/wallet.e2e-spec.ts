/**
 * Integration tests for Phase 6: wallet, ledger, escrow and test-mode payments (FR-450…456).
 * Money invariants are checked with the admin reconciliation endpoint after the money flows.
 */
import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { LedgerReconcileDto, ListingDetailDto, OrderDetailDto, Page, TopupDto, WalletDto, WalletTransactionDto } from '@cc/shared';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetUserData, seedCategories } from './setup/db.js';
import { createTestApp } from './setup/test-app.js';
import { createUser, type TestUser } from './setup/users.js';

let app: INestApplication<App>;
let prisma: PrismaService;
let categoryId: string;
let admin: TestUser;
const api = () => request(app.getHttpServer());

async function verifiedUser(name?: string): Promise<TestUser> {
  const u = await createUser(app, name);
  await prisma.user.update({ where: { id: u.id }, data: { emailVerifiedAt: new Date() } });
  return u;
}

async function wallet(u: TestUser): Promise<WalletDto> {
  return (await api().get('/api/v1/wallet').set(u.auth).expect(200)).body as WalletDto;
}

/** Top up through the fake checkout page (what a user does in the in-app browser). */
async function topUp(u: TestUser, amountPaise: number): Promise<TopupDto> {
  const t = (await api().post('/api/v1/wallet/topups').set(u.auth).send({ amountPaise }).expect(201)).body as TopupDto;
  // checkoutUrl = /api/v1/payments/fake/<id>?token=… → press "Pay": /api/v1/payments/fake/<id>/pay?token=…
  await api().post(t.checkoutUrl.replace('?', '/pay?')).expect(200);
  return t;
}

async function reconcile(): Promise<LedgerReconcileDto> {
  return (await api().get('/api/v1/admin/ledger/reconcile').set(admin.auth).expect(200)).body as LedgerReconcileDto;
}

async function escrowOrder(amountPaise = 100_000) {
  const seller = await verifiedUser('Seller');
  const buyer = await verifiedUser('Buyer');
  const listing = (
    await api()
      .post('/api/v1/listings')
      .set(seller.auth)
      .send({
        type: 'SERVICE_OFFER',
        categoryId,
        title: 'Website for small shops',
        description: 'A simple one-page website with your shop details and map.',
        workMode: 'REMOTE',
        pricingType: 'FIXED',
        pricePaise: amountPaise,
      })
      .expect(201)
  ).body as ListingDetailDto;
  const order = (await api().post('/api/v1/orders').set(buyer.auth).send({ listingId: listing.id, paymentMode: 'ESCROW' }).expect(201))
    .body as OrderDetailDto;
  await api().post(`/api/v1/orders/${order.id}/actions/accept`).set(seller.auth).expect(200);
  return { seller, buyer, order };
}

const act = (u: TestUser, orderId: string, action: string, body?: object) =>
  api().post(`/api/v1/orders/${orderId}/actions/${action}`).set(u.auth).send(body ?? {});

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);
  await resetUserData(app);
  await seedCategories(app);
  categoryId = (await prisma.category.findUniqueOrThrow({ where: { slug: 'graphic-design' } })).id;
  admin = await verifiedUser('Admin');
  await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
});

afterAll(async () => {
  await resetUserData(app);
  await app.close();
});

describe('top-ups with the fake gateway (FR-451)', () => {
  it('checkout page → pay → wallet credited exactly once; history shows it', async () => {
    const u = await verifiedUser();
    expect(await wallet(u)).toEqual({ balancePaise: 0, inEscrowPaise: 0, testMode: true });

    const t = (await api().post('/api/v1/wallet/topups').set(u.auth).send({ amountPaise: 50_000 }).expect(201)).body as TopupDto;
    expect(t).toMatchObject({ status: 'CREATED', gateway: 'fake', amountPaise: 50_000 });
    expect(t.checkoutUrl).toMatch(/^\/api\/v1\/payments\/fake\/[0-9a-f-]+\?token=/);

    const pageRes = await api().get(t.checkoutUrl).expect(200);
    expect(pageRes.text).toContain('TEST MODE');
    expect(pageRes.text).toContain('₹500');

    // "verify" before paying changes nothing.
    expect((await api().post(`/api/v1/wallet/topups/${t.id}/verify`).set(u.auth).expect(200)).body.status).toBe('CREATED');

    await api().post(t.checkoutUrl.replace('?', '/pay?')).expect(200);
    await api().post(t.checkoutUrl.replace('?', '/pay?')).expect(200); // second press: no double credit
    expect((await api().post(`/api/v1/wallet/topups/${t.id}/verify`).set(u.auth).expect(200)).body.status).toBe('PAID');
    expect((await wallet(u)).balancePaise).toBe(50_000);

    const history = (await api().get('/api/v1/wallet/transactions').set(u.auth).expect(200)).body as Page<WalletTransactionDto>;
    expect(history.items).toEqual([expect.objectContaining({ kind: 'TOPUP', amountPaise: 50_000 })]);
  });

  it('cancel adds nothing; wrong token and other users get 404; amounts are bounded', async () => {
    const u = await verifiedUser();
    const other = await verifiedUser();
    const t = (await api().post('/api/v1/wallet/topups').set(u.auth).send({ amountPaise: 20_000 }).expect(201)).body as TopupDto;
    await api().get(t.checkoutUrl.replace(/token=[^&]+/, 'token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).expect(404);
    await api().get(`/api/v1/wallet/topups/${t.id}`).set(other.auth).expect(404);
    await api().post(`/api/v1/wallet/topups/${t.id}/verify`).set(other.auth).expect(404);

    await api().post(t.checkoutUrl.replace('?', '/cancel?')).expect(200);
    expect((await api().get(`/api/v1/wallet/topups/${t.id}`).set(u.auth).expect(200)).body.status).toBe('FAILED');
    await api().post(t.checkoutUrl.replace('?', '/pay?')).expect(200); // too late: stays FAILED
    expect((await wallet(u)).balancePaise).toBe(0);

    await api().post('/api/v1/wallet/topups').set(u.auth).send({ amountPaise: 500 }).expect(400); // < ₹10
    await api().post('/api/v1/wallet/topups').set(u.auth).send({ amountPaise: 6_000_000 }).expect(400); // > ₹50,000
  });
});

describe('escrow orders (FR-452)', () => {
  it('fund → submit → approve moves money buyer → escrow → seller; ledger reconciles', async () => {
    const { seller, buyer, order } = await escrowOrder(100_000);
    expect((await api().get(`/api/v1/orders/${order.id}`).set(buyer.auth).expect(200)).body).toMatchObject({
      status: 'AWAITING_PAYMENT',
      availableActions: expect.arrayContaining(['fund', 'cancel']),
    });

    // Not enough money → refused, nothing changes.
    await topUp(buyer, 40_000);
    const poor = await act(buyer, order.id, 'fund').expect(422);
    expect(poor.body.error.code).toBe('WALLET_INSUFFICIENT_FUNDS');
    expect((await wallet(buyer)).balancePaise).toBe(40_000);

    await topUp(buyer, 80_000);
    expect((await act(buyer, order.id, 'fund').expect(200)).body.status).toBe('IN_PROGRESS');
    expect(await wallet(buyer)).toMatchObject({ balancePaise: 20_000, inEscrowPaise: 100_000 });

    await act(seller, order.id, 'submit').expect(200);
    await act(buyer, order.id, 'approve').expect(200);
    expect(await wallet(buyer)).toMatchObject({ balancePaise: 20_000, inEscrowPaise: 0 });
    expect((await wallet(seller)).balancePaise).toBe(100_000);

    const sellerHistory = (await api().get('/api/v1/wallet/transactions').set(seller.auth).expect(200)).body as Page<WalletTransactionDto>;
    expect(sellerHistory.items[0]).toMatchObject({ kind: 'ESCROW_RELEASE', amountPaise: 100_000, orderId: order.id });
    expect(await reconcile()).toMatchObject({ ok: true, walletMismatches: [], unbalancedTransactions: [], strandedEscrow: [] });
  });

  it('seller backing out after funding refunds the buyer in full', async () => {
    const { seller, buyer, order } = await escrowOrder(60_000);
    await topUp(buyer, 60_000);
    await act(buyer, order.id, 'fund').expect(200);
    expect((await wallet(buyer)).balancePaise).toBe(0);
    await act(seller, order.id, 'cancel', { note: 'Cannot do it, sorry' }).expect(200);
    expect(await wallet(buyer)).toMatchObject({ balancePaise: 60_000, inEscrowPaise: 0 });
    expect((await wallet(seller)).balancePaise).toBe(0);
    expect((await reconcile()).ok).toBe(true);
  });

  it('double-tapping "pay into escrow" charges once', async () => {
    const { buyer, order } = await escrowOrder(30_000);
    await topUp(buyer, 100_000);
    const results = await Promise.all([act(buyer, order.id, 'fund'), act(buyer, order.id, 'fund')]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);
    expect(await wallet(buyer)).toMatchObject({ balancePaise: 70_000, inEscrowPaise: 30_000 });
    expect((await reconcile()).ok).toBe(true);
  });
});

describe('withdrawals (FR-454) and admin reconciliation', () => {
  it('simulated withdrawal reduces the balance; cannot withdraw more than you have', async () => {
    const u = await verifiedUser();
    await topUp(u, 30_000);
    expect((await api().post('/api/v1/wallet/withdrawals').set(u.auth).send({ amountPaise: 40_000 }).expect(422)).body.error.code).toBe(
      'WALLET_INSUFFICIENT_FUNDS',
    );
    const w = await api().post('/api/v1/wallet/withdrawals').set(u.auth).send({ amountPaise: 10_000 }).expect(201);
    expect(w.body.status).toBe('SIMULATED');
    expect((await wallet(u)).balancePaise).toBe(20_000);
    expect(((await api().get('/api/v1/wallet/transactions').set(u.auth).expect(200)).body as Page<WalletTransactionDto>).items[0]).toMatchObject({
      kind: 'WITHDRAWAL',
      amountPaise: -10_000,
    });
  });

  it('reconciliation is admin-only and detects a tampered balance', async () => {
    const u = await verifiedUser();
    await api().get('/api/v1/admin/ledger/reconcile').set(u.auth).expect(403);
    await prisma.wallet.update({ where: { userId: u.id }, data: { balancePaise: 999 } });
    const r = await reconcile();
    expect(r.ok).toBe(false);
    expect(r.walletMismatches).toEqual([{ userId: u.id, cachedPaise: 999, ledgerPaise: 0 }]);
    await prisma.wallet.update({ where: { userId: u.id }, data: { balancePaise: 0 } });
    expect((await reconcile()).ok).toBe(true);
  });
});

describe('Razorpay test mode: webhook + server-side verification (mocked Razorpay API)', () => {
  let rzpApp: INestApplication<App>;
  const WEBHOOK_SECRET = 'whsec_test_123456';
  let paymentLinkStatus = { status: 'created', amount_paid: 0 };

  beforeAll(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/payment_links') && init?.method === 'POST') {
          return Response.json({ id: 'plink_e2e_1', short_url: 'https://rzp.io/i/e2e', status: 'created' });
        }
        if (url.includes('/payment_links/plink_e2e_1')) return Response.json(paymentLinkStatus);
        return new Response('not found', { status: 404 });
      }),
    );
    rzpApp = await createTestApp({
      PAYMENT_GATEWAY: 'razorpay',
      RAZORPAY_KEY_ID: 'rzp_test_e2e',
      RAZORPAY_KEY_SECRET: 'secret_e2e',
      RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    });
  });

  afterAll(async () => {
    await rzpApp.close();
    vi.unstubAllGlobals();
  });

  const webhook = (body: object, secret = WEBHOOK_SECRET) => {
    const raw = JSON.stringify(body);
    return request(rzpApp.getHttpServer())
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', createHmac('sha256', secret).update(raw).digest('hex'))
      .send(raw);
  };

  it('credits only after a correctly signed webhook AND Razorpay confirming the exact amount', async () => {
    const u = await verifiedUser();
    const t = (await request(rzpApp.getHttpServer()).post('/api/v1/wallet/topups').set(u.auth).send({ amountPaise: 25_000 }).expect(201))
      .body as TopupDto;
    expect(t).toMatchObject({ gateway: 'razorpay', checkoutUrl: 'https://rzp.io/i/e2e', status: 'CREATED' });
    const event = { event: 'payment_link.paid', payload: { payment_link: { entity: { id: 'plink_e2e_1' } } } };

    // Forged signature → 401, nothing credited.
    await webhook(event, 'not-the-secret').expect(401);
    // Signed, but Razorpay says a different amount → not credited.
    paymentLinkStatus = { status: 'paid', amount_paid: 1 };
    await webhook(event).expect(200);
    expect((await wallet(u)).balancePaise).toBe(0);
    // Signed and Razorpay confirms the amount → credited once, even if the webhook repeats.
    paymentLinkStatus = { status: 'paid', amount_paid: 25_000 };
    await webhook(event).expect(200);
    await webhook(event).expect(200);
    expect((await wallet(u)).balancePaise).toBe(25_000);
    // The fake checkout does not exist in razorpay mode.
    await request(rzpApp.getHttpServer()).get(`/api/v1/payments/fake/${t.id}?token=AAAAAAAAAAAAAAAAAAAAAAAA`).expect(404);
    expect((await reconcile()).ok).toBe(true);
  });
});
