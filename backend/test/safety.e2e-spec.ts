/**
 * Integration tests for Phase 8: reports (FR-600), admin moderation + suspension + dispute
 * resolution (FR-601), auto-approve job (FR-407), spam guard + per-user rate limits (FR-603).
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { AdminDisputeDto, AdminReportDto, ConversationDto, LedgerReconcileDto, ListingDetailDto, OrderDetailDto, ReportDto, WalletDto } from '@cc/shared';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetUserData, seedCategories } from './setup/db.js';
import { createTestApp } from './setup/test-app.js';
import { createUser, TEST_PASSWORD, type TestUser } from './setup/users.js';

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

function offer(owner: TestUser, overrides: Record<string, unknown> = {}) {
  return api()
    .post('/api/v1/listings')
    .set(owner.auth)
    .send({
      type: 'SERVICE_OFFER',
      categoryId,
      title: 'Mehendi for weddings',
      description: 'Bridal and party mehendi designs, natural henna only.',
      workMode: 'REMOTE',
      pricingType: 'FIXED',
      pricePaise: 100_000,
      ...overrides,
    });
}

async function fundedEscrowOrder() {
  const seller = await verifiedUser('Seller');
  const buyer = await verifiedUser('Buyer');
  const l = (await offer(seller).expect(201)).body as ListingDetailDto;
  const o = (await api().post('/api/v1/orders').set(buyer.auth).send({ listingId: l.id, paymentMode: 'ESCROW' }).expect(201)).body as OrderDetailDto;
  await api().post(`/api/v1/orders/${o.id}/actions/accept`).set(seller.auth).expect(200);
  const t = await api().post('/api/v1/wallet/topups').set(buyer.auth).send({ amountPaise: 100_000 }).expect(201);
  await api().post(t.body.checkoutUrl.replace('?', '/pay?')).expect(200);
  await api().post(`/api/v1/orders/${o.id}/actions/fund`).set(buyer.auth).expect(200);
  return { seller, buyer, order: o };
}

const wallet = async (u: TestUser) => (await api().get('/api/v1/wallet').set(u.auth).expect(200)).body as WalletDto;
const reconcile = async () => (await api().get('/api/v1/admin/ledger/reconcile').set(admin.auth).expect(200)).body as LedgerReconcileDto;

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);
  await resetUserData(app);
  await seedCategories(app);
  categoryId = (await prisma.category.findUniqueOrThrow({ where: { slug: 'mehendi' } })).id;
  admin = await verifiedUser('Admin');
  await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
});

afterAll(async () => {
  await resetUserData(app);
  await app.close();
});

describe('reports (FR-600)', () => {
  it('report a listing, a user, a review and a message (participants only); duplicates reuse the open report', async () => {
    const seller = await verifiedUser();
    const buyer = await verifiedUser();
    const stranger = await verifiedUser();
    const l = (await offer(seller).expect(201)).body as ListingDetailDto;

    const r1 = (await api().post('/api/v1/reports').set(buyer.auth).send({ targetType: 'LISTING', targetId: l.id, reason: 'SCAM', details: 'Asked me to pay outside' }).expect(201)).body as ReportDto;
    const again = (await api().post('/api/v1/reports').set(buyer.auth).send({ targetType: 'LISTING', targetId: l.id, reason: 'SPAM' }).expect(201)).body as ReportDto;
    expect(again.id).toBe(r1.id);
    await api().post('/api/v1/reports').set(buyer.auth).send({ targetType: 'USER', targetId: seller.id, reason: 'ABUSE' }).expect(201);
    expect((await api().post('/api/v1/reports').set(seller.auth).send({ targetType: 'LISTING', targetId: l.id, reason: 'SPAM' }).expect(422)).body.error.code).toBe('CANNOT_REPORT_SELF');

    const c = (await api().post('/api/v1/conversations').set(buyer.auth).send({ listingId: l.id }).expect(200)).body as ConversationDto;
    const msg = (await api().post(`/api/v1/conversations/${c.id}/messages`).set(seller.auth).send({ body: 'rude message' }).expect(201)).body;
    await api().post('/api/v1/reports').set(stranger.auth).send({ targetType: 'MESSAGE', targetId: msg.id, reason: 'ABUSE' }).expect(404);
    await api().post('/api/v1/reports').set(buyer.auth).send({ targetType: 'MESSAGE', targetId: msg.id, reason: 'ABUSE' }).expect(201);
    await api().post('/api/v1/reports').set(buyer.auth).send({ targetType: 'USER', targetId: '01936b6e-7c3a-7d4e-8f00-000000000000', reason: 'ABUSE' }).expect(404);
  });
});

describe('admin moderation (FR-601)', () => {
  it('only admins; ACTION hides a listing, a message and a review; suspension signs the user out everywhere', async () => {
    const seller = await verifiedUser('Bad Seller');
    const buyer = await verifiedUser('Reporter');
    await api().get('/api/v1/admin/reports').set(buyer.auth).expect(403);

    const l = (await offer(seller).expect(201)).body as ListingDetailDto;
    const c = (await api().post('/api/v1/conversations').set(buyer.auth).send({ listingId: l.id }).expect(200)).body as ConversationDto;
    const msg = (await api().post(`/api/v1/conversations/${c.id}/messages`).set(seller.auth).send({ body: 'abusive words here' }).expect(201)).body;
    const rl = (await api().post('/api/v1/reports').set(buyer.auth).send({ targetType: 'LISTING', targetId: l.id, reason: 'SCAM' }).expect(201)).body as ReportDto;
    const rm = (await api().post('/api/v1/reports').set(buyer.auth).send({ targetType: 'MESSAGE', targetId: msg.id, reason: 'ABUSE' }).expect(201)).body as ReportDto;

    const open = (await api().get('/api/v1/admin/reports').set(admin.auth).expect(200)).body as AdminReportDto[];
    const mine = open.filter((r) => [rl.id, rm.id].includes(r.id));
    expect(mine.map((r) => r.target.ownerId)).toEqual([seller.id, seller.id]);
    expect(mine[1]!.target.summary).toContain('abusive words here');

    await api().post(`/api/v1/admin/reports/${rm.id}/resolve`).set(admin.auth).send({ decision: 'ACTION', hideContent: true }).expect(200);
    const msgs = (await api().get(`/api/v1/conversations/${c.id}/messages`).set(buyer.auth).expect(200)).body;
    expect(msgs.items[0].body).toBe('[This message was removed by a moderator]');

    await api().post(`/api/v1/admin/reports/${rl.id}/resolve`).set(admin.auth).send({ decision: 'ACTION', hideContent: true, suspendUser: true, note: 'Scam listing' }).expect(200);
    await api().post(`/api/v1/admin/reports/${rl.id}/resolve`).set(admin.auth).send({ decision: 'DISMISS' }).expect(409);
    await api().get(`/api/v1/listings/${l.id}`).set(buyer.auth).expect(404);
    expect((await api().get('/api/v1/me').set(seller.auth).expect(403)).body.error.code).toBe('AUTH_ACCOUNT_SUSPENDED');
    await api().post('/api/v1/auth/refresh').send({ refreshToken: seller.refreshToken }).expect(401);

    await api().post(`/api/v1/admin/users/${seller.id}/unsuspend`).set(admin.auth).expect(204);
    await api().post('/api/v1/auth/login').send({ email: seller.email, password: TEST_PASSWORD }).expect(200);
    await api().post(`/api/v1/admin/users/${admin.id}/suspend`).set(admin.auth).send({ reason: 'test admin' }).expect(422);
  });

  it('a hidden review no longer counts in ratings', async () => {
    const seller = await verifiedUser();
    const buyer = await verifiedUser();
    const l = (await offer(seller, { title: 'Mehendi party package' }).expect(201)).body as ListingDetailDto;
    const o = (await api().post('/api/v1/orders').set(buyer.auth).send({ listingId: l.id, paymentMode: 'DIRECT' }).expect(201)).body as OrderDetailDto;
    for (const [u, a] of [[seller, 'accept'], [seller, 'submit'], [buyer, 'approve']] as const) {
      await api().post(`/api/v1/orders/${o.id}/actions/${a}`).set(u.auth).expect(200);
    }
    const review = (await api().post(`/api/v1/orders/${o.id}/review`).set(seller.auth).send({ rating: 1, comment: 'insulting review' }).expect(201)).body;
    const report = (await api().post('/api/v1/reports').set(buyer.auth).send({ targetType: 'REVIEW', targetId: review.id, reason: 'ABUSE' }).expect(201)).body as ReportDto;
    expect((await api().get(`/api/v1/users/${buyer.id}`).set(seller.auth).expect(200)).body.rating).toEqual({ average: 1, count: 1 });
    await api().post(`/api/v1/admin/reports/${report.id}/resolve`).set(admin.auth).send({ decision: 'ACTION', hideContent: true }).expect(200);
    expect((await api().get(`/api/v1/users/${buyer.id}`).set(seller.auth).expect(200)).body.rating).toEqual({ average: null, count: 0 });
    expect((await api().get(`/api/v1/users/${buyer.id}/reviews`).set(seller.auth).expect(200)).body.items).toEqual([]);
  });
});

describe('disputes (FR-601, ADR-012)', () => {
  it('REFUND returns escrow to the buyer; RELEASE pays the seller; resolved once; ledger reconciles', async () => {
    const a = await fundedEscrowOrder();
    await api().post(`/api/v1/orders/${a.order.id}/actions/dispute`).set(a.buyer.auth).send({ reason: 'Seller never started the work.' }).expect(200);
    const list = (await api().get('/api/v1/admin/disputes').set(admin.auth).expect(200)).body as AdminDisputeDto[];
    expect(list.find((d) => d.orderId === a.order.id)).toMatchObject({ raisedBy: { role: 'BUYER' }, orderStatus: 'DISPUTED', amountPaise: 100_000 });
    await api().post(`/api/v1/admin/disputes/${a.order.id}/resolve`).set(a.buyer.auth).send({ resolution: 'REFUND', note: 'hack' }).expect(403);
    expect((await api().post(`/api/v1/admin/disputes/${a.order.id}/resolve`).set(admin.auth).send({ resolution: 'REFUND', note: 'No evidence of work' }).expect(200)).body).toEqual({
      orderId: a.order.id,
      status: 'CANCELLED',
    });
    expect(await wallet(a.buyer)).toMatchObject({ balancePaise: 100_000, inEscrowPaise: 0 });
    await api().post(`/api/v1/admin/disputes/${a.order.id}/resolve`).set(admin.auth).send({ resolution: 'RELEASE', note: 'again please' }).expect(409);
    const detail = (await api().get(`/api/v1/orders/${a.order.id}`).set(a.seller.auth).expect(200)).body as OrderDetailDto;
    expect(detail.timeline.at(-1)).toMatchObject({ action: 'resolve-refund', actorRole: 'ADMIN', toStatus: 'CANCELLED' });

    const b = await fundedEscrowOrder();
    await api().post(`/api/v1/orders/${b.order.id}/actions/submit`).set(b.seller.auth).expect(200);
    await api().post(`/api/v1/orders/${b.order.id}/actions/dispute`).set(b.seller.auth).send({ reason: 'Buyer refuses to approve finished work.' }).expect(200);
    await api().post(`/api/v1/admin/disputes/${b.order.id}/resolve`).set(admin.auth).send({ resolution: 'RELEASE', note: 'Work delivered as agreed' }).expect(200);
    expect((await wallet(b.seller)).balancePaise).toBe(100_000);
    expect((await reconcile()).ok).toBe(true);
  });
});

describe('auto-approve job (FR-407)', () => {
  it('approves orders submitted more than 5 days ago and pays the seller; recent ones are untouched', async () => {
    const old = await fundedEscrowOrder();
    await api().post(`/api/v1/orders/${old.order.id}/actions/submit`).set(old.seller.auth).expect(200);
    await prisma.order.update({ where: { id: old.order.id }, data: { submittedAt: new Date(Date.now() - 6 * 24 * 3600 * 1000) } });
    const recent = await fundedEscrowOrder();
    await api().post(`/api/v1/orders/${recent.order.id}/actions/submit`).set(recent.seller.auth).expect(200);

    await api().post('/api/v1/admin/jobs/auto-approve').set(old.buyer.auth).expect(403);
    expect((await api().post('/api/v1/admin/jobs/auto-approve').set(admin.auth).expect(200)).body).toEqual({ approved: 1 });
    const done = (await api().get(`/api/v1/orders/${old.order.id}`).set(old.seller.auth).expect(200)).body as OrderDetailDto;
    expect(done.status).toBe('COMPLETED');
    expect(done.timeline.at(-1)).toMatchObject({ action: 'auto-approve', actorRole: 'SYSTEM' });
    expect((await wallet(old.seller)).balancePaise).toBe(100_000);
    expect((await api().get(`/api/v1/orders/${recent.order.id}`).set(recent.seller.auth).expect(200)).body.status).toBe('SUBMITTED');
    expect((await api().post('/api/v1/admin/jobs/auto-approve').set(admin.auth).expect(200)).body).toEqual({ approved: 0 });
    expect((await reconcile()).ok).toBe(true);
  });
});

describe('spam guard and per-user limits (FR-603)', () => {
  it('refuses scam phrases and link spam in listings, quotes and messages', async () => {
    const seller = await verifiedUser();
    const buyer = await verifiedUser();
    expect((await offer(seller, { description: 'Pay registration fee of ₹500 to get started with work.' }).expect(422)).body.error.code).toBe('CONTENT_NOT_ALLOWED');
    const l = (await offer(seller).expect(201)).body as ListingDetailDto;
    await api().patch(`/api/v1/listings/${l.id}`).set(seller.auth).send({ title: 'Send me the OTP now' }).expect(422);
    const c = (await api().post('/api/v1/conversations').set(buyer.auth).send({ listingId: l.id }).expect(200)).body as ConversationDto;
    await api()
      .post(`/api/v1/conversations/${c.id}/messages`)
      .set(seller.auth)
      .send({ body: 'see https://a.co https://b.co https://c.co https://d.co' })
      .expect(422);

    const job = (
      await api()
        .post('/api/v1/listings')
        .set(buyer.auth)
        .send({ type: 'JOB_REQUEST', categoryId, title: 'Mehendi for my sister', description: 'Bridal mehendi for both hands and feet next month.', workMode: 'REMOTE' })
        .expect(201)
    ).body as ListingDetailDto;
    await api().post(`/api/v1/listings/${job.id}/quotes`).set(seller.auth).send({ amountPaise: 90_000, message: 'First pay a joining fee please' }).expect(422);
  });

  it('limits messages per minute and listings per hour per user', async () => {
    const seller = await verifiedUser();
    const buyer = await verifiedUser();
    const l = (await offer(seller).expect(201)).body as ListingDetailDto;
    const c = (await api().post('/api/v1/conversations').set(buyer.auth).send({ listingId: l.id }).expect(200)).body as ConversationDto;
    for (let i = 0; i < 30; i++) {
      await api().post(`/api/v1/conversations/${c.id}/messages`).set(buyer.auth).send({ body: `message ${i}` }).expect(201);
    }
    expect((await api().post(`/api/v1/conversations/${c.id}/messages`).set(buyer.auth).send({ body: 'one too many' }).expect(429)).body.error.code).toBe('RATE_LIMITED');

    // seller already has 1 listing this hour → 9 more allowed, the 11th is refused.
    for (let i = 0; i < 9; i++) await offer(seller, { title: `Mehendi package ${i}` }).expect(201);
    expect((await offer(seller, { title: 'Mehendi package extra' }).expect(429)).body.error.code).toBe('RATE_LIMITED');
  });
});
