/**
 * Integration tests for Phase 4: quotes (FR-200…203), conversations (FR-250…253), blocks and the
 * socket.io gateway (verified handshake, membership-checked rooms, live delivery).
 */
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { ConversationDto, ListingDetailDto, MessageDto, Page, QuoteDto } from '@cc/shared';
import { TokenService } from '../src/modules/auth/token.service.js';
import { ReportsService } from '../src/modules/safety/reports.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetUserData, seedCategories } from './setup/db.js';
import { createTestApp } from './setup/test-app.js';
import { createUser, type TestUser } from './setup/users.js';

let app: INestApplication<App>;
let prisma: PrismaService;
let baseUrl: string;
let categoryId: string;
const api = () => request(app.getHttpServer());
const sockets: Socket[] = [];

async function verifiedUser(name?: string): Promise<TestUser> {
  const u = await createUser(app, name);
  await prisma.user.update({ where: { id: u.id }, data: { emailVerifiedAt: new Date() } });
  return u;
}

async function postJob(owner: TestUser): Promise<ListingDetailDto> {
  const res = await api()
    .post('/api/v1/listings')
    .set(owner.auth)
    .send({
      type: 'JOB_REQUEST',
      categoryId,
      title: 'Paint my two bedrooms',
      description: 'Two bedrooms, about 400 sq ft of wall each, paint provided by me.',
      workMode: 'REMOTE',
      budgetMaxPaise: 500_000,
    })
    .expect(201);
  return res.body as ListingDetailDto;
}

async function postOffer(owner: TestUser): Promise<ListingDetailDto> {
  const res = await api()
    .post('/api/v1/listings')
    .set(owner.auth)
    .send({
      type: 'SERVICE_OFFER',
      categoryId,
      title: 'Online drawing classes',
      description: 'Weekend drawing classes for kids and adults over video call.',
      workMode: 'REMOTE',
      pricingType: 'HOURLY',
      pricePaise: 40_000,
    })
    .expect(201);
  return res.body as ListingDetailDto;
}

function quote(seller: TestUser, listingId: string, amountPaise = 300_000) {
  return api().post(`/api/v1/listings/${listingId}/quotes`).set(seller.auth).send({ amountPaise, message: 'I can finish this in two days.' });
}

function connect(token: string): Socket {
  const socket = io(baseUrl, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
  sockets.push(socket);
  return socket;
}

function waitFor<T>(socket: Socket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

beforeAll(async () => {
  app = await createTestApp();
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as unknown as Server;
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  prisma = app.get(PrismaService);
  await resetUserData(app);
  await seedCategories(app);
  categoryId = (await prisma.category.findUniqueOrThrow({ where: { slug: 'painting' } })).id;
});

afterEach(() => {
  for (const s of sockets.splice(0)) s.disconnect();
});

afterAll(async () => {
  await resetUserData(app);
  await app.close();
});

describe('quotes (FR-200…203)', () => {
  it('seller quotes once; conversation is opened with the quote; owner sees seller trust info', async () => {
    const buyer = await verifiedUser('Buyer');
    const seller = await verifiedUser('Seller');
    const job = await postJob(buyer);

    const res = await quote(seller, job.id).expect(201);
    const q = res.body as QuoteDto;
    expect(q).toMatchObject({
      status: 'ACTIVE',
      amountPaise: 300_000,
      seller: { id: seller.id, displayName: 'Seller', badges: ['EMAIL_VERIFIED'], rating: { average: null, count: 0 }, completedJobs: 0 },
    });
    expect(q.conversationId).toBeTruthy();

    const dup = await quote(seller, job.id).expect(409);
    expect(dup.body.error.code).toBe('QUOTE_EXISTS');

    const list = (await api().get(`/api/v1/listings/${job.id}/quotes`).set(buyer.auth).expect(200)).body as QuoteDto[];
    expect(list.map((x) => x.id)).toEqual([q.id]);
    // Only the job owner can see the quotes.
    await api().get(`/api/v1/listings/${job.id}/quotes`).set(seller.auth).expect(404);

    // The quote is the first message of the conversation.
    const msgs = (await api().get(`/api/v1/conversations/${q.conversationId}/messages`).set(buyer.auth).expect(200)).body as Page<MessageDto>;
    expect(msgs.items[0]!.body).toContain('₹3,000');
  });

  it('refuses quotes on own jobs, on service offers, without verified email, and on closed jobs', async () => {
    const owner = await verifiedUser();
    const job = await postJob(owner);
    expect((await quote(owner, job.id).expect(422)).body.error.code).toBe('CANNOT_QUOTE_OWN_LISTING');

    const offer = await postOffer(owner);
    const seller = await verifiedUser();
    expect((await quote(seller, offer.id).expect(422)).body.error.code).toBe('QUOTE_NOT_ALLOWED');

    const unverified = await createUser(app);
    expect((await quote(unverified, job.id).expect(403)).body.error.code).toBe('AUTH_EMAIL_NOT_VERIFIED');

    await api().post(`/api/v1/listings/${job.id}/close`).set(owner.auth).expect(200);
    await quote(seller, job.id).expect(404);
  });

  it('seller edits and withdraws (then may re-send); owner rejects (final); others cannot touch it', async () => {
    const buyer = await verifiedUser();
    const seller = await verifiedUser();
    const stranger = await verifiedUser();
    const job = await postJob(buyer);
    const q = (await quote(seller, job.id).expect(201)).body as QuoteDto;

    const edited = await api().patch(`/api/v1/quotes/${q.id}`).set(seller.auth).send({ amountPaise: 250_000, etaDate: '2999-01-01' }).expect(200);
    expect(edited.body).toMatchObject({ amountPaise: 250_000, etaDate: '2999-01-01' });
    await api().patch(`/api/v1/quotes/${q.id}`).set(stranger.auth).send({ amountPaise: 1 }).expect(404);
    await api().post(`/api/v1/quotes/${q.id}/reject`).set(seller.auth).expect(404); // seller can't reject

    await api().post(`/api/v1/quotes/${q.id}/withdraw`).set(seller.auth).expect(200);
    await api().post(`/api/v1/quotes/${q.id}/withdraw`).set(seller.auth).expect(409);
    const resent = (await quote(seller, job.id, 280_000).expect(201)).body as QuoteDto;
    expect(resent).toMatchObject({ id: q.id, status: 'ACTIVE', amountPaise: 280_000 });

    const rejected = await api().post(`/api/v1/quotes/${q.id}/reject`).set(buyer.auth).expect(200);
    expect(rejected.body.status).toBe('REJECTED');
    expect((await quote(seller, job.id).expect(409)).body.error.code).toBe('QUOTE_CLOSED');

    const mine = (await api().get('/api/v1/me/quotes').set(seller.auth).expect(200)).body as (QuoteDto & { listing: { title: string } })[];
    expect(mine[0]).toMatchObject({ id: q.id, status: 'REJECTED', listing: { title: 'Paint my two bedrooms' } });
  });
});

describe('conversations (FR-250…252)', () => {
  it('start from a service offer (idempotent), exchange messages, unread counts, mark read', async () => {
    const seller = await verifiedUser('Teacher');
    const buyer = await verifiedUser('Parent');
    const offer = await postOffer(seller);

    const c1 = (await api().post('/api/v1/conversations').set(buyer.auth).send({ listingId: offer.id }).expect(200)).body as ConversationDto;
    const c2 = (await api().post('/api/v1/conversations').set(buyer.auth).send({ listingId: offer.id }).expect(200)).body as ConversationDto;
    expect(c2.id).toBe(c1.id);
    expect(c1).toMatchObject({ myRole: 'BUYER', other: { id: seller.id, displayName: 'Teacher' }, unreadCount: 0, blocked: false });

    await api().post(`/api/v1/conversations/${c1.id}/messages`).set(buyer.auth).send({ body: 'Hi! Is Saturday free?' }).expect(201);
    await api().post(`/api/v1/conversations/${c1.id}/messages`).set(buyer.auth).send({ body: 'For my daughter, age 9.' }).expect(201);

    const sellerList = (await api().get('/api/v1/conversations').set(seller.auth).expect(200)).body as Page<ConversationDto>;
    expect(sellerList.items[0]).toMatchObject({ id: c1.id, myRole: 'SELLER', unreadCount: 2, lastMessage: { body: 'For my daughter, age 9.' } });
    expect((await api().get('/api/v1/conversations/unread').set(seller.auth).expect(200)).body).toEqual({
      unreadConversations: 1,
      unreadMessages: 2,
    });
    // The sender has nothing unread.
    expect((await api().get('/api/v1/conversations/unread').set(buyer.auth).expect(200)).body.unreadMessages).toBe(0);

    await api().post(`/api/v1/conversations/${c1.id}/read`).set(seller.auth).expect(200);
    expect((await api().get('/api/v1/conversations/unread').set(seller.auth).expect(200)).body.unreadMessages).toBe(0);

    // Newest first, with pagination.
    const page1 = (await api().get(`/api/v1/conversations/${c1.id}/messages`).set(seller.auth).query({ limit: 1 }).expect(200)).body as Page<MessageDto>;
    expect(page1.items[0]!.body).toBe('For my daughter, age 9.');
    const page2 = (await api().get(`/api/v1/conversations/${c1.id}/messages`).set(seller.auth).query({ limit: 1, cursor: page1.nextCursor! }).expect(200))
      .body as Page<MessageDto>;
    expect(page2.items[0]!.body).toBe('Hi! Is Saturday free?');
  });

  it('only participants can read or write; cannot contact yourself; empty messages rejected', async () => {
    const seller = await verifiedUser();
    const buyer = await verifiedUser();
    const stranger = await verifiedUser();
    const offer = await postOffer(seller);
    const c = (await api().post('/api/v1/conversations').set(buyer.auth).send({ listingId: offer.id }).expect(200)).body as ConversationDto;

    await api().get(`/api/v1/conversations/${c.id}`).set(stranger.auth).expect(404);
    await api().get(`/api/v1/conversations/${c.id}/messages`).set(stranger.auth).expect(404);
    await api().post(`/api/v1/conversations/${c.id}/messages`).set(stranger.auth).send({ body: 'hi' }).expect(404);
    await api().post(`/api/v1/conversations/${c.id}/read`).set(stranger.auth).expect(404);
    expect((await api().post('/api/v1/conversations').set(seller.auth).send({ listingId: offer.id }).expect(422)).body.error.code).toBe(
      'CANNOT_CONTACT_SELF',
    );
    await api().post(`/api/v1/conversations/${c.id}/messages`).set(buyer.auth).send({ body: '   ' }).expect(400);
  });
});

describe('blocking (FR-253)', () => {
  it('blocks messages, new conversations and quotes in both directions; unblock restores', async () => {
    const seller = await verifiedUser();
    const buyer = await verifiedUser();
    const offer = await postOffer(seller);
    const job = await postJob(buyer);
    const c = (await api().post('/api/v1/conversations').set(buyer.auth).send({ listingId: offer.id }).expect(200)).body as ConversationDto;

    await api().post('/api/v1/blocks').set(seller.auth).send({ userId: buyer.id }).expect(204);
    await api().post('/api/v1/blocks').set(seller.auth).send({ userId: buyer.id }).expect(204); // idempotent
    expect((await api().post(`/api/v1/conversations/${c.id}/messages`).set(buyer.auth).send({ body: 'hello?' }).expect(403)).body.error.code).toBe(
      'USER_BLOCKED',
    );
    await api().post(`/api/v1/conversations/${c.id}/messages`).set(seller.auth).send({ body: 'hello' }).expect(403);
    await api().post('/api/v1/conversations').set(buyer.auth).send({ listingId: offer.id }).expect(403);
    await quote(seller, job.id).expect(403);
    expect((await api().get(`/api/v1/conversations/${c.id}`).set(buyer.auth).expect(200)).body.blocked).toBe(true);
    expect((await api().get('/api/v1/blocks').set(seller.auth).expect(200)).body).toEqual([
      { userId: buyer.id, displayName: 'Test User', blockedAt: expect.any(String) },
    ]);
    await api().post('/api/v1/blocks').set(seller.auth).send({ userId: seller.id }).expect(400);

    await api().delete(`/api/v1/blocks/${buyer.id}`).set(seller.auth).expect(204);
    await api().post(`/api/v1/conversations/${c.id}/messages`).set(buyer.auth).send({ body: 'thanks' }).expect(201);
  });
});

describe('realtime (FR-251, ARCHITECTURE §9)', () => {
  it('refuses connections without a valid, signed token', async () => {
    const u = await verifiedUser();
    const forged = await new TokenService({ ...app.get(TokenService)['env'], JWT_ACCESS_SECRET: 'f'.repeat(40) }).signAccessToken(u.id);
    for (const token of ['', 'garbage', forged.token]) {
      const s = connect(token);
      const err = await waitFor<Error>(s, 'connect_error');
      expect(err.message).toBe('AUTH_FAILED');
    }
  });

  it('delivers new messages live to the other participant; strangers cannot join the room', async () => {
    const seller = await verifiedUser();
    const buyer = await verifiedUser();
    const stranger = await verifiedUser();
    const offer = await postOffer(seller);
    const c = (await api().post('/api/v1/conversations').set(buyer.auth).send({ listingId: offer.id }).expect(200)).body as ConversationDto;

    const sellerSocket = connect(seller.token);
    await waitFor(sellerSocket, 'connect');
    const strangerSocket = connect(stranger.token);
    await waitFor(strangerSocket, 'connect');

    // Room join is membership-checked.
    expect(await sellerSocket.emitWithAck('conversation:join', { conversationId: c.id })).toEqual({ ok: true });
    expect(await strangerSocket.emitWithAck('conversation:join', { conversationId: c.id })).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(await strangerSocket.emitWithAck('conversation:join', { conversationId: 'nope' })).toEqual({
      ok: false,
      code: 'VALIDATION_FAILED',
    });

    let strangerGotIt = false;
    strangerSocket.on('message:new', () => (strangerGotIt = true));
    const received = waitFor<MessageDto>(sellerSocket, 'message:new');
    await api().post(`/api/v1/conversations/${c.id}/messages`).set(buyer.auth).send({ body: 'Live hello' }).expect(201);
    const msg = await received;
    expect(msg).toMatchObject({ conversationId: c.id, senderId: buyer.id, body: 'Live hello' });

    // Read receipts are delivered too.
    const readEvent = waitFor<{ userId: string }>(sellerSocket, 'conversation:read');
    await api().post(`/api/v1/conversations/${c.id}/read`).set(buyer.auth).expect(200);
    expect((await readEvent).userId).toBe(buyer.id);

    await new Promise((r) => setTimeout(r, 200));
    expect(strangerGotIt).toBe(false);
  });

  it('suspended users cannot connect', async () => {
    const u = await verifiedUser();
    await prisma.user.update({ where: { id: u.id }, data: { status: 'SUSPENDED' } });
    const s = connect(u.token);
    expect((await waitFor<Error>(s, 'connect_error')).message).toBe('AUTH_FAILED');
  });

  // Phase 9 security review: sockets used to live forever after the handshake.
  it('suspending a user closes their live sockets at once', async () => {
    const u = await verifiedUser();
    const s = connect(u.token);
    await waitFor(s, 'connect');
    const closed = waitFor<string>(s, 'disconnect');
    await app.get(ReportsService).suspend(u.id);
    expect(await closed).toBe('io server disconnect');
  });

  it('closes a socket when its access token expires', async () => {
    const u = await verifiedUser();
    // A token issued almost 15 minutes ago → expires in ~1.5 s.
    const { token } = await app.get(TokenService).signAccessToken(u.id, new Date(Date.now() - (15 * 60 - 1.5) * 1000));
    const s = connect(token);
    await waitFor(s, 'connect');
    expect(await waitFor<string>(s, 'disconnect', 4000)).toBe('io server disconnect');
  });
});
