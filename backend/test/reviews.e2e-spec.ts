/**
 * Integration tests for Phase 7: reviews (FR-500…502), public work record (FR-053),
 * notifications (FR-550) and push-token registration (FR-551).
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { ListingDetailDto, NotificationDto, OrderDetailDto, Page, PublicProfile, ReviewDto, WorkRecordDto } from '@cc/shared';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetUserData, seedCategories } from './setup/db.js';
import { createTestApp } from './setup/test-app.js';
import { createUser, type TestUser } from './setup/users.js';

let app: INestApplication<App>;
let prisma: PrismaService;
let categoryId: string;
const api = () => request(app.getHttpServer());

async function verifiedUser(name?: string): Promise<TestUser> {
  const u = await createUser(app, name);
  await prisma.user.update({ where: { id: u.id }, data: { emailVerifiedAt: new Date() } });
  return u;
}

/** A DIRECT order taken to COMPLETED. */
async function completedOrder(seller: TestUser, buyer: TestUser, title = 'Birthday cake for 20 people'): Promise<OrderDetailDto> {
  const l = (
    await api()
      .post('/api/v1/listings')
      .set(seller.auth)
      .send({
        type: 'SERVICE_OFFER',
        categoryId,
        title,
        description: 'Homemade eggless cakes, any flavour, delivered fresh.',
        workMode: 'REMOTE',
        pricingType: 'FIXED',
        pricePaise: 120_000,
      })
      .expect(201)
  ).body as ListingDetailDto;
  const o = (await api().post('/api/v1/orders').set(buyer.auth).send({ listingId: l.id, paymentMode: 'DIRECT' }).expect(201)).body as OrderDetailDto;
  for (const [u, a] of [
    [seller, 'accept'],
    [seller, 'submit'],
    [buyer, 'approve'],
  ] as const) {
    await api().post(`/api/v1/orders/${o.id}/actions/${a}`).set(u.auth).expect(200);
  }
  return o;
}

async function notifications(u: TestUser) {
  return (await api().get('/api/v1/notifications').set(u.auth).expect(200)).body as Page<NotificationDto> & { unreadCount: number };
}

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);
  await resetUserData(app);
  await seedCategories(app);
  categoryId = (await prisma.category.findUniqueOrThrow({ where: { slug: 'baking' } })).id;
});

afterAll(async () => {
  await resetUserData(app);
  await app.close();
});

describe('reviews (FR-500…502)', () => {
  it('both sides review a completed order once; reviewee replies once; aggregates update', async () => {
    const seller = await verifiedUser('Baker');
    const buyer = await verifiedUser('Customer');
    const o = await completedOrder(seller, buyer);

    const before = (await api().get(`/api/v1/orders/${o.id}`).set(buyer.auth).expect(200)).body as OrderDetailDto;
    expect(before.reviews).toMatchObject({ mine: null, theirs: null, canReview: true });

    const r1 = (await api().post(`/api/v1/orders/${o.id}/review`).set(buyer.auth).send({ rating: 5, comment: 'Delicious and on time!' }).expect(201))
      .body as ReviewDto;
    expect(r1).toMatchObject({ rating: 5, reviewerRole: 'BUYER', reviewer: { id: buyer.id }, orderTitle: 'Birthday cake for 20 people' });
    expect((await api().post(`/api/v1/orders/${o.id}/review`).set(buyer.auth).send({ rating: 1 }).expect(409)).body.error.code).toBe('REVIEW_EXISTS');
    await api().post(`/api/v1/orders/${o.id}/review`).set(seller.auth).send({ rating: 4 }).expect(201);

    const after = (await api().get(`/api/v1/orders/${o.id}`).set(buyer.auth).expect(200)).body as OrderDetailDto;
    expect(after.reviews).toMatchObject({ mine: { rating: 5 }, theirs: { rating: 4, reviewerRole: 'SELLER' }, canReview: false });

    // Reply: only the reviewee, only once.
    await api().post(`/api/v1/reviews/${r1.id}/reply`).set(buyer.auth).send({ reply: 'me again' }).expect(404);
    const replied = (await api().post(`/api/v1/reviews/${r1.id}/reply`).set(seller.auth).send({ reply: 'Thank you so much!' }).expect(200)).body as ReviewDto;
    expect(replied.reply).toBe('Thank you so much!');
    expect((await api().post(`/api/v1/reviews/${r1.id}/reply`).set(seller.auth).send({ reply: 'again' }).expect(409)).body.error.code).toBe(
      'REVIEW_ALREADY_REPLIED',
    );

    const list = (await api().get(`/api/v1/users/${seller.id}/reviews`).set(buyer.auth).expect(200)).body as Page<ReviewDto>;
    expect(list.items.map((r) => r.id)).toEqual([r1.id]);
    const profile = (await api().get(`/api/v1/users/${seller.id}`).set(buyer.auth).expect(200)).body as PublicProfile;
    expect(profile).toMatchObject({ rating: { average: 5, count: 1 }, completedJobs: 1 });
  });

  it('refuses reviews on unfinished orders, by strangers, out of range, or after 14 days', async () => {
    const seller = await verifiedUser();
    const buyer = await verifiedUser();
    const stranger = await verifiedUser();
    const o = await completedOrder(seller, buyer);
    await api().post(`/api/v1/orders/${o.id}/review`).set(stranger.auth).send({ rating: 3 }).expect(404);
    await api().post(`/api/v1/orders/${o.id}/review`).set(buyer.auth).send({ rating: 6 }).expect(400);
    await api().post(`/api/v1/orders/${o.id}/review`).set(buyer.auth).send({ rating: 0 }).expect(400);

    await prisma.order.update({ where: { id: o.id }, data: { completedAt: new Date(Date.now() - 15 * 24 * 3600 * 1000) } });
    expect((await api().post(`/api/v1/orders/${o.id}/review`).set(buyer.auth).send({ rating: 4 }).expect(422)).body.error.code).toBe(
      'REVIEW_WINDOW_CLOSED',
    );

    const l2 = await prisma.listing.findFirstOrThrow({ where: { ownerId: seller.id } });
    const open = (await api().post('/api/v1/orders').set(buyer.auth).send({ listingId: l2.id, paymentMode: 'DIRECT' }).expect(201)).body as OrderDetailDto;
    expect((await api().post(`/api/v1/orders/${open.id}/review`).set(buyer.auth).send({ rating: 4 }).expect(422)).body.error.code).toBe(
      'ORDER_NOT_COMPLETED',
    );
  });
});

describe('verified work record (FR-053)', () => {
  it('public JSON and HTML: completed jobs with category, month, rating and comment — no names or contacts', async () => {
    const seller = await verifiedUser('Asha <script>alert(1)</script>');
    const buyer = await verifiedUser('Private Buyer Name');
    const o = await completedOrder(seller, buyer);
    await api().post(`/api/v1/orders/${o.id}/review`).set(buyer.auth).send({ rating: 4, comment: 'Great work <b>really</b>' }).expect(201);

    const json = (await api().get(`/api/v1/users/${seller.id}/work-record`).expect(200)).body as WorkRecordDto; // no auth needed
    expect(json).toMatchObject({ completedJobs: 1, rating: { average: 4, count: 1 } });
    expect(json.entries).toEqual([{ orderId: o.id, category: expect.any(String), completedMonth: expect.stringMatching(/^\d{4}-\d{2}$/), rating: 4, comment: 'Great work <b>really</b>' }]);
    const text = JSON.stringify(json);
    expect(text).not.toContain('Private Buyer Name');
    expect(text).not.toContain(seller.email);
    expect(text).not.toContain('120000');

    const html = await api().get(`/api/v1/work-record/${seller.id}`).expect(200);
    expect(html.headers['content-type']).toContain('text/html');
    expect(html.text).toContain('Great work &lt;b&gt;really&lt;/b&gt;');
    expect(html.text).toContain('Asha &lt;script&gt;');
    expect(html.text).not.toContain('<script>');
    expect(html.text).not.toContain('Private Buyer Name');

    await prisma.user.update({ where: { id: seller.id }, data: { status: 'SUSPENDED' } });
    await api().get(`/api/v1/users/${seller.id}/work-record`).expect(404);
  });
});

describe('notifications (FR-550)', () => {
  it('quote, booking, order changes, payment, review and messages notify the right person', async () => {
    const seller = await verifiedUser('Seller');
    const buyer = await verifiedUser('Buyer');

    // Job request → quote → owner notified.
    const job = (
      await api()
        .post('/api/v1/listings')
        .set(buyer.auth)
        .send({ type: 'JOB_REQUEST', categoryId, title: 'Need 50 cupcakes', description: 'For a college event next week, assorted flavours.', workMode: 'REMOTE' })
        .expect(201)
    ).body as ListingDetailDto;
    const q = await api().post(`/api/v1/listings/${job.id}/quotes`).set(seller.auth).send({ amountPaise: 150_000, message: 'Happy to bake them for you.' }).expect(201);
    let n = await notifications(buyer);
    expect(n.items[0]).toMatchObject({ type: 'QUOTE_NEW', read: false, link: { kind: 'quotes', id: job.id } });
    expect(n.items.some((x) => x.type === 'MESSAGE_NEW')).toBe(false); // the quote message itself does not double-notify

    // Accept → seller notified; then order changes notify the other side.
    const order = (await api().post(`/api/v1/quotes/${q.body.id}/accept`).set(buyer.auth).send({ paymentMode: 'ESCROW' }).expect(201)).body as OrderDetailDto;
    expect((await notifications(seller)).items[0]).toMatchObject({ type: 'QUOTE_ACCEPTED', link: { kind: 'order', id: order.id } });

    const topup = await api().post('/api/v1/wallet/topups').set(buyer.auth).send({ amountPaise: 150_000 }).expect(201);
    await api().post(topup.body.checkoutUrl.replace('?', '/pay?')).expect(200);
    expect((await notifications(buyer)).items[0]).toMatchObject({ type: 'TOPUP_PAID', link: { kind: 'wallet' } });

    await api().post(`/api/v1/orders/${order.id}/actions/fund`).set(buyer.auth).expect(200);
    expect((await notifications(seller)).items[0]).toMatchObject({ type: 'ORDER_STATUS', title: expect.stringContaining('paid into escrow') });
    await api().post(`/api/v1/orders/${order.id}/actions/submit`).set(seller.auth).expect(200);
    expect((await notifications(buyer)).items[0]!.title).toContain('marked the work as done');
    await api().post(`/api/v1/orders/${order.id}/actions/approve`).set(buyer.auth).expect(200);
    const sellerN = await notifications(seller);
    expect(sellerN.items.slice(0, 2).map((x) => x.type).sort()).toEqual(['ORDER_STATUS', 'PAYMENT_RECEIVED']);

    await api().post(`/api/v1/orders/${order.id}/review`).set(buyer.auth).send({ rating: 5 }).expect(201);
    expect((await notifications(seller)).items[0]).toMatchObject({ type: 'REVIEW_RECEIVED' });

    // Chat messages collapse into one unread notification per conversation.
    const convId = order.conversationId!;
    for (const body of ['Thanks!', 'See you next time', 'Bye']) {
      await api().post(`/api/v1/conversations/${convId}/messages`).set(buyer.auth).send({ body }).expect(201);
    }
    n = await notifications(seller);
    const msgNotifs = n.items.filter((x) => x.type === 'MESSAGE_NEW');
    expect(msgNotifs).toHaveLength(1);
    expect(msgNotifs[0]).toMatchObject({ title: 'Buyer', body: 'Bye', link: { kind: 'conversation', id: convId } });

    // Mark read: one, then all.
    const before = n.unreadCount;
    expect((await api().post('/api/v1/notifications/read').set(seller.auth).send({ ids: [msgNotifs[0]!.id] }).expect(200)).body.unreadCount).toBe(before - 1);
    expect((await api().post('/api/v1/notifications/read').set(seller.auth).send({}).expect(200)).body.unreadCount).toBe(0);
    expect((await api().get('/api/v1/notifications/unread-count').set(seller.auth).expect(200)).body).toEqual({ unreadCount: 0 });

    // A new message after reading creates a fresh notification.
    await api().post(`/api/v1/conversations/${convId}/messages`).set(buyer.auth).send({ body: 'One more thing' }).expect(201);
    expect((await notifications(seller)).unreadCount).toBe(1);
  });

  it('notifications are private', async () => {
    const a = await verifiedUser();
    const b = await verifiedUser();
    const offer = (
      await api()
        .post('/api/v1/listings')
        .set(a.auth)
        .send({ type: 'SERVICE_OFFER', categoryId, title: 'Cupcake boxes', description: 'Boxes of six cupcakes, any flavour you like.', workMode: 'REMOTE', pricingType: 'FIXED', pricePaise: 50_000 })
        .expect(201)
    ).body as ListingDetailDto;
    await api().post('/api/v1/orders').set(b.auth).send({ listingId: offer.id, paymentMode: 'DIRECT' }).expect(201);
    const mine = await notifications(a);
    expect(mine.items[0]!.type).toBe('BOOKING_REQUEST');
    // b cannot mark a's notification as read (silently ignored), and does not see it.
    await api().post('/api/v1/notifications/read').set(b.auth).send({ ids: [mine.items[0]!.id] }).expect(200);
    expect((await notifications(a)).items[0]!.read).toBe(false);
    expect((await notifications(b)).items.find((x) => x.id === mine.items[0]!.id)).toBeUndefined();
  });
});

describe('push tokens (FR-551)', () => {
  it('registers, moves to the latest user on the same device, and removes on sign-out', async () => {
    const a = await verifiedUser();
    const b = await verifiedUser();
    const token = 'ExponentPushToken[abc123XYZ]';
    await api().post('/api/v1/me/push-tokens').set(a.auth).send({ token, platform: 'android' }).expect(204);
    expect((await prisma.pushToken.findUniqueOrThrow({ where: { token } })).userId).toBe(a.id);
    await api().post('/api/v1/me/push-tokens').set(b.auth).send({ token, platform: 'android' }).expect(204);
    expect((await prisma.pushToken.findUniqueOrThrow({ where: { token } })).userId).toBe(b.id);
    await api().delete('/api/v1/me/push-tokens').set(a.auth).send({ token }).expect(204); // not a's anymore → no effect
    expect(await prisma.pushToken.count({ where: { token } })).toBe(1);
    await api().delete('/api/v1/me/push-tokens').set(b.auth).send({ token }).expect(204);
    expect(await prisma.pushToken.count({ where: { token } })).toBe(0);
    await api().post('/api/v1/me/push-tokens').set(a.auth).send({ token: 'not-a-token' }).expect(400);
  });
});
