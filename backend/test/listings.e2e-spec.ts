/**
 * Integration tests for Phase 3: listings (create/edit/pause/resume/close, visibility, photos)
 * and search (keyword, filters, near-me distance, sorting, cursor pagination).
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { ListingDetailDto, ListingSummaryDto, Page } from '@cc/shared';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetUserData, seedCategories } from './setup/db.js';
import { createTestApp } from './setup/test-app.js';
import { createUser, uploadImage, type TestUser } from './setup/users.js';

let app: INestApplication<App>;
let prisma: PrismaService;
const api = () => request(app.getHttpServer());

// Hyderabad landmarks (lat, lng).
const CHARMINAR = { lat: 17.3616, lng: 78.4747 };
const HITEC_CITY = { lat: 17.4474, lng: 78.3762 }; // ~14 km from Charminar
const SECUNDERABAD = { lat: 17.4399, lng: 78.4983 }; // ~9 km from Charminar
const VIJAYAWADA = { lat: 16.5062, lng: 80.648 }; // ~250 km away

let categoryId: string;
let otherCategoryId: string;
let gatedCategoryId: string;

async function verifiedUser(name?: string): Promise<TestUser> {
  const u = await createUser(app, name);
  await prisma.user.update({ where: { id: u.id }, data: { emailVerifiedAt: new Date() } });
  return u;
}

function offer(overrides: Record<string, unknown> = {}) {
  return {
    type: 'SERVICE_OFFER',
    categoryId,
    title: 'Home wall painting',
    description: 'Neat interior wall painting with my own brushes and rollers.',
    workMode: 'ONSITE',
    city: 'Hyderabad',
    location: CHARMINAR,
    pricingType: 'FIXED',
    pricePaise: 150_000,
    ...overrides,
  };
}

function job(overrides: Record<string, unknown> = {}) {
  return {
    type: 'JOB_REQUEST',
    categoryId,
    title: 'Need a logo for my tiffin centre',
    description: 'Looking for a simple logo and a printable banner for my small shop.',
    workMode: 'REMOTE',
    budgetMinPaise: 50_000,
    budgetMaxPaise: 200_000,
    ...overrides,
  };
}

async function post(user: TestUser, body: Record<string, unknown>): Promise<ListingDetailDto> {
  const res = await api().post('/api/v1/listings').set(user.auth).send(body).expect(201);
  return res.body as ListingDetailDto;
}

async function search(user: TestUser, query: Record<string, string | number>): Promise<Page<ListingSummaryDto>> {
  const res = await api().get('/api/v1/listings').set(user.auth).query(query).expect(200);
  return res.body as Page<ListingSummaryDto>;
}

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);
  await resetUserData(app);
  await seedCategories(app);
  categoryId = (await prisma.category.findUniqueOrThrow({ where: { slug: 'painting' } })).id;
  otherCategoryId = (await prisma.category.findUniqueOrThrow({ where: { slug: 'graphic-design' } })).id;
  gatedCategoryId = (await prisma.category.findUniqueOrThrow({ where: { slug: 'babysitting' } })).id;
});

afterAll(async () => {
  await resetUserData(app);
  await app.close();
});

describe('creating listings (FR-150, FR-151)', () => {
  it('needs a verified email', async () => {
    const u = await createUser(app);
    const res = await api().post('/api/v1/listings').set(u.auth).send(offer()).expect(403);
    expect(res.body.error.code).toBe('AUTH_EMAIL_NOT_VERIFIED');
  });

  it('creates a service offer with photos; location is rounded and never returned', async () => {
    const u = await verifiedUser('Asha Painter');
    const key = await uploadImage(app, u, 'LISTING');
    const l = await post(u, offer({ location: { lat: 17.361634, lng: 78.474712 }, imageUploadKeys: [key] }));
    expect(l).toMatchObject({
      type: 'SERVICE_OFFER',
      status: 'ACTIVE',
      pricingType: 'FIXED',
      pricePaise: 150_000,
      city: 'Hyderabad',
      isOwner: true,
      owner: { id: u.id, displayName: 'Asha Painter', isStudent: false },
      category: { id: categoryId },
    });
    expect(l.imageUrls).toEqual([`/api/v1/uploads/files/${key}`]);
    expect(l.coverImageUrl).toBe(l.imageUrls[0]);
    expect(JSON.stringify(l)).not.toMatch(/"lat"|"lng"/);
    expect(l.imageKeys).toEqual([key]); // owner only
    const viewer = await createUser(app);
    const seen = (await api().get(`/api/v1/listings/${l.id}`).set(viewer.auth).expect(200)).body as ListingDetailDto;
    expect(seen.imageKeys).toEqual([]);
    expect(seen.isOwner).toBe(false);
    const row = await prisma.listing.findUniqueOrThrow({ where: { id: l.id } });
    expect([row.lat, row.lng]).toEqual([17.362, 78.475]);
  });

  it('creates a job request (pricing forced to QUOTE, no location for remote work)', async () => {
    const u = await verifiedUser();
    const l = await post(u, job({ preferredDate: '2999-12-31' }));
    expect(l).toMatchObject({ type: 'JOB_REQUEST', pricingType: 'QUOTE', budgetMinPaise: 50_000, preferredDate: '2999-12-31' });
  });

  it('rejects gated categories, unknown categories, broken rules and another user’s photos', async () => {
    const u = await verifiedUser();
    const other = await verifiedUser();
    expect((await api().post('/api/v1/listings').set(u.auth).send(offer({ categoryId: gatedCategoryId })).expect(422)).body.error.code).toBe(
      'CATEGORY_NOT_AVAILABLE',
    );
    await api()
      .post('/api/v1/listings')
      .set(u.auth)
      .send(offer({ categoryId: '01936b6e-7c3a-7d4e-8f00-000000000000' }))
      .expect(422);
    await api().post('/api/v1/listings').set(u.auth).send(offer({ pricePaise: undefined })).expect(400);
    await api().post('/api/v1/listings').set(u.auth).send(offer({ location: null })).expect(400);
    await api().post('/api/v1/listings').set(u.auth).send(job({ pricePaise: 100 })).expect(400);
    const stolen = await uploadImage(app, other, 'LISTING');
    expect((await api().post('/api/v1/listings').set(u.auth).send(offer({ imageUploadKeys: [stolen] })).expect(400)).body.error.code).toBe(
      'UPLOAD_INVALID',
    );
  });
});

describe('editing and status (FR-150, FR-152)', () => {
  it('owner edits; merged result must still follow the rules; photos are replaced and removed ones deleted', async () => {
    const u = await verifiedUser();
    const k1 = await uploadImage(app, u, 'LISTING');
    const k2 = await uploadImage(app, u, 'LISTING');
    const l = await post(u, offer({ imageUploadKeys: [k1, k2] }));

    const k3 = await uploadImage(app, u, 'LISTING');
    const edited = await api()
      .patch(`/api/v1/listings/${l.id}`)
      .set(u.auth)
      .send({ title: 'Wall painting and texture', pricingType: 'HOURLY', pricePaise: 30_000, imageUploadKeys: [k2, k3] })
      .expect(200);
    expect(edited.body).toMatchObject({ title: 'Wall painting and texture', pricingType: 'HOURLY', pricePaise: 30_000 });
    expect(edited.body.imageUrls).toEqual([`/api/v1/uploads/files/${k2}`, `/api/v1/uploads/files/${k3}`]);
    await api().get(`/api/v1/uploads/files/${k1}`).expect(404);

    // Switching to QUOTE while keeping a price breaks the rules → 400 with details.
    const bad = await api().patch(`/api/v1/listings/${l.id}`).set(u.auth).send({ pricingType: 'QUOTE' }).expect(400);
    expect(bad.body.error.details).toEqual([{ path: 'pricePaise', message: expect.any(String) }]);
    await api().patch(`/api/v1/listings/${l.id}`).set(u.auth).send({ pricingType: 'QUOTE', pricePaise: null }).expect(200);
    // Remote work drops the location.
    await api().patch(`/api/v1/listings/${l.id}`).set(u.auth).send({ workMode: 'REMOTE' }).expect(200);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).lat).toBeNull();
  });

  it('only the owner can edit or change status (others get 404)', async () => {
    const owner = await verifiedUser();
    const other = await verifiedUser();
    const l = await post(owner, offer());
    await api().patch(`/api/v1/listings/${l.id}`).set(other.auth).send({ title: 'Hacked title' }).expect(404);
    await api().post(`/api/v1/listings/${l.id}/close`).set(other.auth).expect(404);
  });

  it('pause hides it from others, resume shows it again, close is final and closes open quotes', async () => {
    const owner = await verifiedUser();
    const viewer = await verifiedUser();
    const l = await post(owner, job());
    const quote = await prisma.quote.create({
      data: { listingId: l.id, sellerId: viewer.id, amountPaise: 90_000, message: 'I can do it' },
    });

    await api().post(`/api/v1/listings/${l.id}/pause`).set(owner.auth).expect(200);
    await api().get(`/api/v1/listings/${l.id}`).set(viewer.auth).expect(404);
    expect((await api().get(`/api/v1/listings/${l.id}`).set(owner.auth).expect(200)).body.status).toBe('PAUSED');
    await api().post(`/api/v1/listings/${l.id}/pause`).set(owner.auth).expect(409);

    await api().post(`/api/v1/listings/${l.id}/resume`).set(owner.auth).expect(200);
    await api().get(`/api/v1/listings/${l.id}`).set(viewer.auth).expect(200);

    await api().post(`/api/v1/listings/${l.id}/close`).set(owner.auth).expect(200);
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe('NOT_SELECTED');
    await api().post(`/api/v1/listings/${l.id}/resume`).set(owner.auth).expect(409);
    const editClosed = await api().patch(`/api/v1/listings/${l.id}`).set(owner.auth).send({ title: 'Too late now' }).expect(409);
    expect(editClosed.body.error.code).toBe('LISTING_CLOSED');
    await api().get(`/api/v1/listings/${l.id}`).set(viewer.auth).expect(404);
    expect(await prisma.listing.count({ where: { id: l.id } })).toBe(1); // never hard-deleted
  });

  it('listings of suspended users disappear for others', async () => {
    const owner = await verifiedUser();
    const viewer = await verifiedUser();
    const l = await post(owner, offer());
    await prisma.user.update({ where: { id: owner.id }, data: { status: 'SUSPENDED' } });
    await api().get(`/api/v1/listings/${l.id}`).set(viewer.auth).expect(404);
  });
});

describe('search (FR-101…103)', () => {
  let viewer: TestUser;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    await resetUserData(app); // start the search tests from an empty marketplace
    const seller = await verifiedUser('Seller One');
    const buyer = await verifiedUser('Buyer One');
    viewer = await verifiedUser('Viewer');
    ids.charminar = (await post(seller, offer({ title: 'Wall painting Old City', pricePaise: 100_000 }))).id;
    ids.secunderabad = (await post(seller, offer({ title: 'Texture painting', location: SECUNDERABAD, pricePaise: 300_000 }))).id;
    ids.hitec = (await post(seller, offer({ title: 'Office painting', location: HITEC_CITY, pricePaise: 200_000 }))).id;
    ids.vijayawada = (await post(seller, offer({ title: 'Painting in Vijayawada', city: 'Vijayawada', location: VIJAYAWADA }))).id;
    ids.logo = (await post(buyer, job({ categoryId: otherCategoryId }))).id;
    ids.remoteOffer = (await post(seller, offer({ title: 'Online painting classes', workMode: 'REMOTE', location: null, city: null, pricingType: 'HOURLY', pricePaise: 50_000 }))).id;
    const paused = await post(seller, offer({ title: 'Paused painting offer' }));
    await api().post(`/api/v1/listings/${paused.id}/pause`).set(seller.auth).expect(200);
  });

  it('newest first, only active listings', async () => {
    const page = await search(viewer, {});
    expect(page.items.map((i) => i.id)).toEqual([
      ids.remoteOffer,
      ids.logo,
      ids.vijayawada,
      ids.hitec,
      ids.secunderabad,
      ids.charminar,
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it('keyword (all words, case-insensitive), type, category, work mode, city and price filters', async () => {
    expect((await search(viewer, { q: 'PAINTING old' })).items.map((i) => i.id)).toEqual([ids.charminar]);
    expect((await search(viewer, { type: 'JOB_REQUEST' })).items.map((i) => i.id)).toEqual([ids.logo]);
    expect((await search(viewer, { categoryId: otherCategoryId })).items.map((i) => i.id)).toEqual([ids.logo]);
    expect((await search(viewer, { workMode: 'REMOTE', type: 'SERVICE_OFFER' })).items.map((i) => i.id)).toEqual([ids.remoteOffer]);
    expect((await search(viewer, { city: 'vijayawada' })).items.map((i) => i.id)).toEqual([ids.vijayawada]);
    // Bounds are inclusive: the ₹1,500 Vijayawada offer is in [₹1,500, ₹2,500], the ₹1,000 one is not.
    const priced = await search(viewer, { type: 'SERVICE_OFFER', minPricePaise: 150_000, maxPricePaise: 250_000 });
    expect(priced.items.map((i) => i.id)).toEqual([ids.vijayawada, ids.hitec]);
  });

  it('near me: radius filter, distance sort and distances; far listings excluded', async () => {
    const near = await search(viewer, { lat: CHARMINAR.lat, lng: CHARMINAR.lng, radiusKm: 12, sort: 'distance' });
    expect(near.items.map((i) => i.id)).toEqual([ids.charminar, ids.secunderabad]);
    expect(near.items[0]!.distanceKm).toBeLessThan(0.5);
    expect(near.items[1]!.distanceKm).toBeGreaterThan(7);
    expect(near.items[1]!.distanceKm).toBeLessThan(12);

    const wide = await search(viewer, { lat: CHARMINAR.lat, lng: CHARMINAR.lng, radiusKm: 50, sort: 'distance' });
    expect(wide.items.map((i) => i.id)).toEqual([ids.charminar, ids.secunderabad, ids.hitec]);

    // Without a radius, distances are still shown when a location is sent.
    const withDistances = await search(viewer, { lat: CHARMINAR.lat, lng: CHARMINAR.lng, q: 'vijayawada' });
    expect(withDistances.items[0]!.distanceKm).toBeGreaterThan(200);
  });

  it('price sort and cursor pagination (keyset and offset) return every item exactly once', async () => {
    const asc = await search(viewer, { type: 'SERVICE_OFFER', workMode: 'ONSITE', sort: 'price_asc' });
    expect(asc.items.map((i) => i.pricePaise)).toEqual([100_000, 150_000, 200_000, 300_000]);

    for (const sort of ['newest', 'price_desc']) {
      const seen: string[] = [];
      let cursor: string | null | undefined;
      do {
        const page = await search(viewer, { sort, limit: 2, ...(cursor ? { cursor } : {}) });
        seen.push(...page.items.map((i) => i.id));
        cursor = page.nextCursor;
      } while (cursor);
      expect(seen).toHaveLength(6);
      expect(new Set(seen).size).toBe(6);
    }
    const geoSeen: string[] = [];
    let cursor: string | null | undefined;
    do {
      const page = await search(viewer, {
        lat: CHARMINAR.lat,
        lng: CHARMINAR.lng,
        radiusKm: 50,
        sort: 'distance',
        limit: 1,
        ...(cursor ? { cursor } : {}),
      });
      geoSeen.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(geoSeen).toEqual([ids.charminar, ids.secunderabad, ids.hitec]);
  });

  it('validates the query string and cursors', async () => {
    await api().get('/api/v1/listings').set(viewer.auth).query({ radiusKm: 10 }).expect(400);
    await api().get('/api/v1/listings').set(viewer.auth).query({ unknown: 'x' }).expect(400);
    const bad = await api().get('/api/v1/listings').set(viewer.auth).query({ cursor: 'garbage' }).expect(400);
    expect(bad.body.error.code).toBe('INVALID_CURSOR');
    await api().get('/api/v1/listings').expect(401);
  });
});

describe('my listings', () => {
  it('lists all of my listings with status filter and pagination', async () => {
    const u = await verifiedUser();
    const a = await post(u, offer({ title: 'First offer here' }));
    const b = await post(u, job({ title: 'Second request here' }));
    await api().post(`/api/v1/listings/${a.id}/pause`).set(u.auth).expect(200);

    const all = (await api().get('/api/v1/me/listings').set(u.auth).expect(200)).body as Page<ListingSummaryDto>;
    expect(all.items.map((i) => i.id)).toEqual([b.id, a.id]);
    const paused = (await api().get('/api/v1/me/listings').set(u.auth).query({ status: 'PAUSED' }).expect(200)).body as Page<ListingSummaryDto>;
    expect(paused.items.map((i) => i.id)).toEqual([a.id]);
    const first = (await api().get('/api/v1/me/listings').set(u.auth).query({ limit: 1 }).expect(200)).body as Page<ListingSummaryDto>;
    expect(first.items).toHaveLength(1);
    const second = (await api().get('/api/v1/me/listings').set(u.auth).query({ limit: 1, cursor: first.nextCursor! }).expect(200))
      .body as Page<ListingSummaryDto>;
    expect(second.items.map((i) => i.id)).toEqual([a.id]);
    expect(second.nextCursor).toBeNull();
  });
});
