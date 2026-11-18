/**
 * Integration tests for Phase 5: orders (FR-400…409) — booking and quote acceptance, every
 * state-machine path for DIRECT payment, actor permissions, change-request limit, disputes,
 * concurrency (optimistic locking) and on-site start/finish codes.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { ListingDetailDto, OrderDetailDto, OrderSummaryDto, Page, QuoteDto } from '@cc/shared';
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

async function offer(owner: TestUser, overrides: Record<string, unknown> = {}): Promise<ListingDetailDto> {
  const res = await api()
    .post('/api/v1/listings')
    .set(owner.auth)
    .send({
      type: 'SERVICE_OFFER',
      categoryId,
      title: 'Logo design for your shop',
      description: 'Simple, clean logo with two revisions and source files.',
      workMode: 'REMOTE',
      pricingType: 'FIXED',
      pricePaise: 150_000,
      ...overrides,
    })
    .expect(201);
  return res.body as ListingDetailDto;
}

function book(buyer: TestUser, listingId: string, overrides: Record<string, unknown> = {}) {
  return api().post('/api/v1/orders').set(buyer.auth).send({ listingId, paymentMode: 'DIRECT', requirements: 'Blue and white colours', ...overrides });
}

function act(user: TestUser, orderId: string, action: string, body?: Record<string, unknown>) {
  const req = api().post(`/api/v1/orders/${orderId}/actions/${action}`).set(user.auth);
  return body ? req.send(body) : req;
}

async function detail(user: TestUser, orderId: string): Promise<OrderDetailDto> {
  return (await api().get(`/api/v1/orders/${orderId}`).set(user.auth).expect(200)).body as OrderDetailDto;
}

/** A booked + accepted DIRECT order (IN_PROGRESS). */
async function inProgressOrder(listingOverrides: Record<string, unknown> = {}) {
  const seller = await verifiedUser('Seller');
  const buyer = await verifiedUser('Buyer');
  const l = await offer(seller, listingOverrides);
  const order = (await book(buyer, l.id).expect(201)).body as OrderDetailDto;
  await act(seller, order.id, 'accept').expect(200);
  return { seller, buyer, order };
}

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);
  await resetUserData(app);
  await seedCategories(app);
  categoryId = (await prisma.category.findUniqueOrThrow({ where: { slug: 'graphic-design' } })).id;
});

afterAll(async () => {
  await resetUserData(app);
  await app.close();
});

describe('booking a service (FR-400a, FR-402)', () => {
  it('full DIRECT lifecycle: book → accept → submit → request changes → submit → approve, with timeline', async () => {
    const seller = await verifiedUser('Seller');
    const buyer = await verifiedUser('Buyer');
    const l = await offer(seller);

    const booked = (await book(buyer, l.id).expect(201)).body as OrderDetailDto;
    expect(booked).toMatchObject({
      status: 'REQUESTED',
      role: 'BUYER',
      amountPaise: 150_000,
      paymentMode: 'DIRECT',
      source: 'BOOKING',
      requirements: 'Blue and white colours',
      other: { id: seller.id },
      availableActions: ['cancel'],
    });
    expect(booked.conversationId).toBeTruthy();
    expect((await detail(seller, booked.id)).availableActions.sort()).toEqual(['accept', 'decline']);

    await act(seller, booked.id, 'accept').expect(200);
    expect((await detail(seller, booked.id)).availableActions.sort()).toEqual(['cancel', 'dispute', 'submit']);
    expect((await detail(buyer, booked.id)).availableActions).toEqual(['dispute']);

    await act(seller, booked.id, 'submit').expect(200);
    const submitted = await detail(buyer, booked.id);
    expect(submitted.status).toBe('SUBMITTED');
    expect(Date.parse(submitted.autoApproveAt!) - Date.parse(submitted.submittedAt!)).toBe(5 * 24 * 3600 * 1000);

    await act(buyer, booked.id, 'request-changes', { note: 'Make the font bigger' }).expect(200);
    await act(seller, booked.id, 'submit').expect(200);
    const done = (await act(buyer, booked.id, 'approve').expect(200)).body as OrderDetailDto;
    expect(done).toMatchObject({ status: 'COMPLETED', changeRequests: 1, availableActions: [] });
    expect(done.completedAt).toBeTruthy();
    expect(done.timeline.map((e) => [e.action, e.actorRole, e.toStatus])).toEqual([
      ['book', 'BUYER', 'REQUESTED'],
      ['accept', 'SELLER', 'IN_PROGRESS'],
      ['submit', 'SELLER', 'SUBMITTED'],
      ['request-changes', 'BUYER', 'IN_PROGRESS'],
      ['submit', 'SELLER', 'SUBMITTED'],
      ['approve', 'BUYER', 'COMPLETED'],
    ]);
    expect(done.timeline[3]!.note).toBe('Make the font bigger');

    // Lists: my orders as buyer, my jobs as seller.
    const asBuyer = (await api().get('/api/v1/orders').set(buyer.auth).query({ role: 'buyer' }).expect(200)).body as Page<OrderSummaryDto>;
    expect(asBuyer.items.map((o) => o.id)).toEqual([booked.id]);
    const asSeller = (await api().get('/api/v1/orders').set(seller.auth).query({ role: 'seller', status: 'COMPLETED' }).expect(200))
      .body as Page<OrderSummaryDto>;
    expect(asSeller.items[0]).toMatchObject({ id: booked.id, role: 'SELLER', other: { id: buyer.id } });
    expect((await api().get('/api/v1/orders').set(seller.auth).query({ role: 'buyer' }).expect(200)).body.items).toEqual([]);
  });

  it('prices: fixed price, hourly × hours, agreed amount for quote-priced offers', async () => {
    const seller = await verifiedUser();
    const buyer = await verifiedUser();
    const hourly = await offer(seller, { pricingType: 'HOURLY', pricePaise: 40_000 });
    const quoted = await offer(seller, { pricingType: 'QUOTE', pricePaise: null });
    const fixed = await offer(seller);

    expect((await book(buyer, hourly.id, { hours: 3 }).expect(201)).body.amountPaise).toBe(120_000);
    await book(buyer, hourly.id).expect(400);
    expect((await book(buyer, quoted.id, { amountPaise: 99_900 }).expect(201)).body.amountPaise).toBe(99_900);
    await book(buyer, quoted.id).expect(400);
    await book(buyer, fixed.id, { amountPaise: 1 }).expect(400); // cannot override a fixed price
  });

  it('refuses own listings, job requests, blocked pairs and unverified buyers', async () => {
    const seller = await verifiedUser();
    const buyer = await verifiedUser();
    const l = await offer(seller);
    expect((await book(seller, l.id).expect(422)).body.error.code).toBe('CANNOT_ORDER_OWN_LISTING');

    const job = await api()
      .post('/api/v1/listings')
      .set(seller.auth)
      .send({ type: 'JOB_REQUEST', categoryId, title: 'Need a website', description: 'A simple website for my coaching centre please.', workMode: 'REMOTE' })
      .expect(201);
    expect((await book(buyer, job.body.id).expect(422)).body.error.code).toBe('BOOKING_NOT_ALLOWED');

    const unverified = await createUser(app);
    await book(unverified, l.id).expect(403);

    await api().post('/api/v1/blocks').set(seller.auth).send({ userId: buyer.id }).expect(204);
    expect((await book(buyer, l.id).expect(403)).body.error.code).toBe('USER_BLOCKED');
  });
});

describe('permissions and rules (FR-401, FR-404, FR-405)', () => {
  it('wrong actor → 403, impossible action → 409, strangers → 404', async () => {
    const seller = await verifiedUser();
    const buyer = await verifiedUser();
    const stranger = await verifiedUser();
    const l = await offer(seller);
    const o = (await book(buyer, l.id).expect(201)).body as OrderDetailDto;

    expect((await act(buyer, o.id, 'accept').expect(403)).body.error.code).toBe('ORDER_ACTION_NOT_ALLOWED');
    expect((await act(buyer, o.id, 'approve').expect(409)).body.error.code).toBe('ORDER_INVALID_TRANSITION');
    await act(stranger, o.id, 'accept').expect(404);
    await api().get(`/api/v1/orders/${o.id}`).set(stranger.auth).expect(404);
    await act(seller, o.id, 'not-an-action').expect(400);
  });

  it('decline and cancel paths; after work starts only the seller can cancel', async () => {
    const seller = await verifiedUser();
    const buyer = await verifiedUser();
    const l = await offer(seller);

    const declined = (await book(buyer, l.id).expect(201)).body as OrderDetailDto;
    expect((await act(seller, declined.id, 'decline').expect(200)).body.status).toBe('DECLINED');

    const cancelled = (await book(buyer, l.id).expect(201)).body as OrderDetailDto;
    expect((await act(buyer, cancelled.id, 'cancel').expect(200)).body.status).toBe('CANCELLED');

    const started = (await book(buyer, l.id).expect(201)).body as OrderDetailDto;
    await act(seller, started.id, 'accept').expect(200);
    await act(buyer, started.id, 'cancel').expect(403);
    expect((await act(seller, started.id, 'cancel', { note: 'Fell sick, sorry' }).expect(200)).body.status).toBe('CANCELLED');
  });

  it('changes can be requested at most 3 times', async () => {
    const { seller, buyer, order } = await inProgressOrder();
    for (let i = 0; i < 3; i++) {
      await act(seller, order.id, 'submit').expect(200);
      await act(buyer, order.id, 'request-changes').expect(200);
    }
    await act(seller, order.id, 'submit').expect(200);
    const res = await act(buyer, order.id, 'request-changes').expect(422);
    expect(res.body.error.code).toBe('ORDER_RULE_VIOLATION');
    expect((await detail(buyer, order.id)).availableActions.sort()).toEqual(['approve', 'dispute']);
  });

  it('a dispute needs a reason and is shown to both sides', async () => {
    const { seller, buyer, order } = await inProgressOrder();
    await act(buyer, order.id, 'dispute').expect(400);
    await act(buyer, order.id, 'dispute', { reason: 'short' }).expect(400);
    await act(buyer, order.id, 'dispute', { reason: 'The seller stopped replying for a week.' }).expect(200);
    const s = await detail(seller, order.id);
    expect(s).toMatchObject({ status: 'DISPUTED', availableActions: [], dispute: { status: 'OPEN', raisedByMe: false, reason: 'The seller stopped replying for a week.' } });
  });

  it('two simultaneous identical actions: exactly one succeeds (optimistic lock)', async () => {
    const { seller, buyer, order } = await inProgressOrder();
    await act(seller, order.id, 'submit').expect(200);
    const results = await Promise.all([act(buyer, order.id, 'approve'), act(buyer, order.id, 'approve')]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);
    const events = (await detail(buyer, order.id)).timeline.filter((e) => e.action === 'approve');
    expect(events).toHaveLength(1);
  });
});

describe('accepting a quote (FR-202)', () => {
  it('creates an IN_PROGRESS order, accepts the quote, closes the job and un-selects other quotes', async () => {
    const buyer = await verifiedUser('Job Owner');
    const s1 = await verifiedUser('Seller A');
    const s2 = await verifiedUser('Seller B');
    const job = (
      await api()
        .post('/api/v1/listings')
        .set(buyer.auth)
        .send({ type: 'JOB_REQUEST', categoryId, title: 'Poster for college fest', description: 'A3 poster for our college cultural fest next month.', workMode: 'REMOTE' })
        .expect(201)
    ).body as ListingDetailDto;
    const q1 = (await api().post(`/api/v1/listings/${job.id}/quotes`).set(s1.auth).send({ amountPaise: 80_000, message: 'Can do in two days.', etaDate: '2999-01-10' }).expect(201))
      .body as QuoteDto;
    const q2 = (await api().post(`/api/v1/listings/${job.id}/quotes`).set(s2.auth).send({ amountPaise: 60_000, message: 'Can do it today itself.' }).expect(201))
      .body as QuoteDto;

    await api().post(`/api/v1/quotes/${q1.id}/accept`).set(s2.auth).send({ paymentMode: 'DIRECT' }).expect(404); // not the owner
    const order = (await api().post(`/api/v1/quotes/${q1.id}/accept`).set(buyer.auth).send({ paymentMode: 'DIRECT' }).expect(201)).body as OrderDetailDto;
    expect(order).toMatchObject({ status: 'IN_PROGRESS', source: 'QUOTE', amountPaise: 80_000, deadline: '2999-01-10', other: { id: s1.id } });
    expect(order.conversationId).toBe(q1.conversationId);

    expect((await prisma.quote.findUniqueOrThrow({ where: { id: q1.id } })).status).toBe('ACCEPTED');
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: q2.id } })).status).toBe('NOT_SELECTED');
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('CLOSED');

    // A second acceptance is impossible.
    await api().post(`/api/v1/quotes/${q2.id}/accept`).set(buyer.auth).send({ paymentMode: 'DIRECT' }).expect(409);
    // The seller sees it as a job.
    expect((await detail(s1, order.id)).availableActions.sort()).toEqual(['cancel', 'dispute', 'submit']);
  });
});

describe('on-site start/finish codes (FR-406)', () => {
  it('buyer sees the codes; seller must enter start, then finish code to submit', async () => {
    const { seller, buyer, order } = await inProgressOrder({ workMode: 'ONSITE', city: 'Hyderabad', location: { lat: 17.4, lng: 78.5 } });

    const b = await detail(buyer, order.id);
    expect(b.onsite).toMatchObject({ required: true, startedAt: null, finishCode: null, canStart: false });
    expect(b.onsite.startCode).toMatch(/^\d{4}$/);
    const s = await detail(seller, order.id);
    expect(s.onsite).toMatchObject({ startCode: null, finishCode: null, canStart: true });

    expect((await act(seller, order.id, 'submit').expect(422)).body.error.code).toBe('ORDER_NOT_STARTED');
    const wrong = b.onsite.startCode === '0000' ? '1111' : '0000';
    expect((await api().post(`/api/v1/orders/${order.id}/start`).set(seller.auth).send({ code: wrong }).expect(400)).body.error.code).toBe('ORDER_CODE_INVALID');
    await api().post(`/api/v1/orders/${order.id}/start`).set(buyer.auth).send({ code: b.onsite.startCode }).expect(403);
    await api().post(`/api/v1/orders/${order.id}/start`).set(seller.auth).send({ code: b.onsite.startCode }).expect(200);
    await api().post(`/api/v1/orders/${order.id}/start`).set(seller.auth).send({ code: b.onsite.startCode }).expect(409);

    const afterStart = await detail(buyer, order.id);
    expect(afterStart.onsite.startCode).toBeNull();
    expect(afterStart.onsite.finishCode).toMatch(/^\d{4}$/);

    await act(seller, order.id, 'submit').expect(400);
    // Start and finish codes are independent 4-digit values (equal ~1 in 10,000 orders).
    if (b.onsite.startCode !== afterStart.onsite.finishCode) {
      await act(seller, order.id, 'submit', { code: b.onsite.startCode }).expect(400);
    }
    await act(seller, order.id, 'submit', { code: afterStart.onsite.finishCode }).expect(200);
    expect((await detail(buyer, order.id)).timeline.map((e) => e.action)).toContain('start');
  });
});
