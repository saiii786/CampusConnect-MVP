/**
 * Integration tests for Phase 2: profile, uploads (local driver), public profiles, portfolio,
 * student badge, categories, admin student domains and account deletion — real app, real test DB.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { CategoriesResponse, MeResponse, PortfolioItemDto, PublicProfile, UploadTarget } from '@cc/shared';
import { ConsoleMailService, MailService } from '../src/modules/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetUserData, seedCategories } from './setup/db.js';
import { createTestApp } from './setup/test-app.js';
import { createUser, JPEG_BYTES, TEST_PASSWORD, uploadImage, type TestUser } from './setup/users.js';

let app: INestApplication<App>;
let prisma: PrismaService;
let mail: ConsoleMailService;
const api = () => request(app.getHttpServer());

function lastCode(email: string): string {
  const code = mail.lastTo(email)?.subject.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`no code emailed to ${email}`);
  return code;
}

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);
  mail = app.get(MailService) as ConsoleMailService;
  await resetUserData(app);
  await prisma.studentDomain.deleteMany();
  await seedCategories(app);
});

afterAll(async () => {
  await resetUserData(app);
  await prisma.studentDomain.deleteMany();
  await app.close();
});

describe('own profile (T2.1)', () => {
  it('PATCH /me updates only the given fields and cleans tags', async () => {
    const u = await createUser(app);
    const res = await api()
      .patch('/api/v1/me')
      .set(u.auth)
      .send({ bio: 'I paint walls', city: 'Hyderabad', skills: ['Painting', 'painting', ' Tutoring '], languages: ['Telugu'] })
      .expect(200);
    const me = res.body as MeResponse;
    expect(me.profile).toMatchObject({
      displayName: 'Test User',
      bio: 'I paint walls',
      city: 'Hyderabad',
      skills: ['Painting', 'Tutoring'],
      languages: ['Telugu'],
    });
    const cleared = await api().patch('/api/v1/me').set(u.auth).send({ bio: '' }).expect(200);
    expect(cleared.body.profile.bio).toBeNull();
    expect(cleared.body.profile.city).toBe('Hyderabad');
  });

  it('rejects unknown fields (no changing email/role this way) and empty updates', async () => {
    const u = await createUser(app);
    for (const body of [{ email: 'x@y.co' }, { role: 'ADMIN' }, {}]) {
      const res = await api().patch('/api/v1/me').set(u.auth).send(body).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    }
  });
});

describe('uploads and avatar (T2.4)', () => {
  it('upload → set avatar → served as an image; replacing deletes the old file; null removes', async () => {
    const u = await createUser(app);
    const first = await uploadImage(app, u, 'AVATAR');
    const set = await api().patch('/api/v1/me').set(u.auth).send({ avatarUploadKey: first }).expect(200);
    const url1 = (set.body as MeResponse).profile.avatarUrl!;
    expect(url1).toBe(`/api/v1/uploads/files/${first}`);
    const served = await api().get(url1).expect(200);
    expect(served.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(served.body as Buffer, JPEG_BYTES)).toBe(0);

    const second = await uploadImage(app, u, 'AVATAR');
    await api().patch('/api/v1/me').set(u.auth).send({ avatarUploadKey: second }).expect(200);
    await api().get(url1).expect(404);

    const removed = await api().patch('/api/v1/me').set(u.auth).send({ avatarUploadKey: null }).expect(200);
    expect(removed.body.profile.avatarUrl).toBeNull();
    await api().get(`/api/v1/uploads/files/${second}`).expect(404);
  });

  it('cannot use another user’s upload, a portfolio upload as avatar, or a key never uploaded', async () => {
    const alice = await createUser(app);
    const bob = await createUser(app);
    const aliceKey = await uploadImage(app, alice, 'AVATAR');
    const bobPortfolioKey = await uploadImage(app, bob, 'PORTFOLIO');

    const stolen = await api().patch('/api/v1/me').set(bob.auth).send({ avatarUploadKey: aliceKey }).expect(400);
    expect(stolen.body.error.code).toBe('UPLOAD_INVALID');
    const wrongPurpose = await api().patch('/api/v1/me').set(bob.auth).send({ avatarUploadKey: bobPortfolioKey }).expect(400);
    expect(wrongPurpose.body.error.code).toBe('UPLOAD_INVALID');

    const sign = await api()
      .post('/api/v1/uploads/sign')
      .set(bob.auth)
      .send({ purpose: 'AVATAR', contentType: 'image/jpeg', sizeBytes: 100 })
      .expect(200);
    const never = await api()
      .patch('/api/v1/me')
      .set(bob.auth)
      .send({ avatarUploadKey: (sign.body as UploadTarget).key })
      .expect(400);
    expect(never.body.error.code).toBe('UPLOAD_NOT_FOUND');
  });

  it('local upload rejects non-images, mismatched types, tampered tokens and oversized files', async () => {
    const u = await createUser(app);
    const sign = async () =>
      (
        await api()
          .post('/api/v1/uploads/sign')
          .set(u.auth)
          .send({ purpose: 'AVATAR', contentType: 'image/jpeg', sizeBytes: 100 })
          .expect(200)
      ).body as UploadTarget;

    const t1 = await sign();
    const html = await api().put(t1.uploadUrl).set('Content-Type', 'image/jpeg').send(Buffer.from('<html><script>')).expect(415);
    expect(html.body.error.code).toBe('UPLOAD_CONTENT_TYPE');

    const t2 = await sign();
    await api().put(t2.uploadUrl).set('Content-Type', 'image/png').send(JPEG_BYTES).expect(415);

    const t3 = await sign();
    const [payload] = t3.uploadUrl.split('/').pop()!.split('.');
    await api().put(`/api/v1/uploads/local/${payload}.forgedsignature`).set(t3.headers).send(JPEG_BYTES).expect(400);

    const t4 = await sign();
    const big = Buffer.concat([JPEG_BYTES, Buffer.alloc(5 * 1024 * 1024)]);
    await api().put(t4.uploadUrl).set(t4.headers).send(big).expect(413);

    expect(
      (await api().post('/api/v1/uploads/sign').set(u.auth).send({ purpose: 'AVATAR', contentType: 'image/gif', sizeBytes: 10 })).status,
    ).toBe(400);
    await api().post('/api/v1/uploads/sign').send({ purpose: 'AVATAR', contentType: 'image/jpeg', sizeBytes: 10 }).expect(401);
  });
});

describe('portfolio (T2.5)', () => {
  it('create, reorder, owner-only edits, max 10, delete compacts positions', async () => {
    const u = await createUser(app);
    const other = await createUser(app);
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const key = await uploadImage(app, u, 'PORTFOLIO');
      const res = await api().post('/api/v1/me/portfolio').set(u.auth).send({ title: `Work ${i}`, uploadKey: key }).expect(201);
      expect((res.body as PortfolioItemDto).position).toBe(i);
      ids.push(res.body.id);
    }
    const key11 = await uploadImage(app, u, 'PORTFOLIO');
    const limit = await api().post('/api/v1/me/portfolio').set(u.auth).send({ title: 'One too many', uploadKey: key11 }).expect(422);
    expect(limit.body.error.code).toBe('PORTFOLIO_LIMIT');
    await api().get(`/api/v1/uploads/files/${key11}`).expect(404); // rejected upload cleaned up

    // Move the last item to the front.
    await api().patch(`/api/v1/me/portfolio/${ids[9]}`).set(u.auth).send({ position: 0, title: 'Best work' }).expect(200);
    let list = (await api().get('/api/v1/me/portfolio').set(u.auth).expect(200)).body as PortfolioItemDto[];
    expect(list[0]).toMatchObject({ id: ids[9], title: 'Best work', position: 0 });
    expect(list.map((i) => i.position)).toEqual([...Array(10).keys()]);

    // Another user can neither edit nor delete it (404, not 403 — no id probing).
    await api().patch(`/api/v1/me/portfolio/${ids[0]}`).set(other.auth).send({ title: 'hacked' }).expect(404);
    await api().delete(`/api/v1/me/portfolio/${ids[0]}`).set(other.auth).expect(404);

    await api().delete(`/api/v1/me/portfolio/${ids[9]}`).set(u.auth).expect(204);
    list = (await api().get('/api/v1/me/portfolio').set(u.auth).expect(200)).body as PortfolioItemDto[];
    expect(list).toHaveLength(9);
    expect(list.map((i) => i.position)).toEqual([...Array(9).keys()]);
    await api().patch('/api/v1/me/portfolio/not-a-uuid').set(u.auth).send({ title: 'x' }).expect(400);
  });
});

describe('public profiles (T2.1, FR-052, FR-054)', () => {
  it('shows public fields, badges and portfolio — never email or private data', async () => {
    const seller = await createUser(app, 'Ravi Kumar');
    const viewer = await createUser(app);
    await api().patch('/api/v1/me').set(seller.auth).send({ city: 'Hyderabad', skills: ['Plumbing'] }).expect(200);
    const key = await uploadImage(app, seller, 'PORTFOLIO');
    await api().post('/api/v1/me/portfolio').set(seller.auth).send({ title: 'Kitchen sink', uploadKey: key }).expect(201);

    const res = await api().get(`/api/v1/users/${seller.id}`).set(viewer.auth).expect(200);
    const profile = res.body as PublicProfile;
    expect(profile).toMatchObject({
      id: seller.id,
      displayName: 'Ravi Kumar',
      city: 'Hyderabad',
      skills: ['Plumbing'],
      badges: [],
      rating: { average: null, count: 0 },
      completedJobs: 0,
    });
    expect(profile.portfolio).toHaveLength(1);
    const text = JSON.stringify(profile);
    expect(text).not.toContain(seller.email);
    expect(text).not.toMatch(/dateOfBirth|passwordHash|studentEmail|"lat"|"lng"/);
  });

  it('404 for unknown and suspended users; 400 for malformed ids; sign-in required', async () => {
    const viewer = await createUser(app);
    const suspended = await createUser(app);
    await prisma.user.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });
    await api().get(`/api/v1/users/${suspended.id}`).set(viewer.auth).expect(404);
    await api().get('/api/v1/users/01936b6e-7c3a-7d4e-8f00-000000000000').set(viewer.auth).expect(404);
    await api().get('/api/v1/users/123').set(viewer.auth).expect(400);
    await api().get(`/api/v1/users/${viewer.id}`).expect(401);
  });
});

describe('student badge (T2.2, FR-004)', () => {
  it('refuses non-college emails', async () => {
    const u = await createUser(app);
    const res = await api().post('/api/v1/me/student-verification').set(u.auth).send({ collegeEmail: 'me@gmail.com' }).expect(422);
    expect(res.body.error.code).toBe('STUDENT_DOMAIN_NOT_ALLOWED');
  });

  it('code to the college email → wrong code counted → right code grants the badge', async () => {
    const u = await createUser(app);
    const collegeEmail = `s${Date.now()}@cse.iith.ac.in`;
    const start = await api().post('/api/v1/me/student-verification').set(u.auth).send({ collegeEmail }).expect(200);
    expect((start.body as MeResponse).student).toEqual({ verified: false, collegeEmail: null, pendingEmail: collegeEmail });

    const code = lastCode(collegeEmail);
    const wrong = code === '000000' ? '111111' : '000000';
    const bad = await api().post('/api/v1/me/student-verification/confirm').set(u.auth).send({ code: wrong }).expect(400);
    expect(bad.body.error).toMatchObject({ code: 'AUTH_CODE_INVALID', details: { attemptsLeft: 4 } });

    const ok = await api().post('/api/v1/me/student-verification/confirm').set(u.auth).send({ code }).expect(200);
    expect((ok.body as MeResponse).student).toEqual({ verified: true, collegeEmail, pendingEmail: null });

    const viewer = await createUser(app);
    const pub = (await api().get(`/api/v1/users/${u.id}`).set(viewer.auth).expect(200)).body as PublicProfile;
    expect(pub.badges).toContain('STUDENT');
    expect(JSON.stringify(pub)).not.toContain(collegeEmail);

    // The same college email cannot verify a second account.
    const other = await createUser(app);
    const dup = await api().post('/api/v1/me/student-verification').set(other.auth).send({ collegeEmail }).expect(409);
    expect(dup.body.error.code).toBe('STUDENT_EMAIL_IN_USE');
  });

  it('admin allow/deny list: custom domains accepted with college name; blocked domains refused', async () => {
    const admin = await createUser(app);
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
    const student = await createUser(app);

    // Normal users cannot touch the list.
    await api().get('/api/v1/admin/student-domains').set(student.auth).expect(403);
    await api()
      .post('/api/v1/admin/student-domains')
      .set(student.auth)
      .send({ domain: 'evil.com', collegeName: 'Evil', allowed: true })
      .expect(403);

    await api()
      .post('/api/v1/admin/student-domains')
      .set(admin.auth)
      .send({ domain: 'MyCollege.org', collegeName: 'My College of Engineering' })
      .expect(200);
    await api()
      .post('/api/v1/admin/student-domains')
      .set(admin.auth)
      .send({ domain: 'fake.ac.in', collegeName: 'Not a college', allowed: false })
      .expect(200);
    const list = await api().get('/api/v1/admin/student-domains').set(admin.auth).expect(200);
    expect(list.body.map((d: { domain: string }) => d.domain)).toEqual(['fake.ac.in', 'mycollege.org']);

    const blocked = await api()
      .post('/api/v1/me/student-verification')
      .set(student.auth)
      .send({ collegeEmail: 'x@fake.ac.in' })
      .expect(422);
    expect(blocked.body.error.code).toBe('STUDENT_DOMAIN_NOT_ALLOWED');

    const email = `x${Date.now()}@mycollege.org`;
    await api().post('/api/v1/me/student-verification').set(student.auth).send({ collegeEmail: email }).expect(200);
    const ok = await api()
      .post('/api/v1/me/student-verification/confirm')
      .set(student.auth)
      .send({ code: lastCode(email) })
      .expect(200);
    expect((ok.body as MeResponse).profile.collegeName).toBe('My College of Engineering');
  });

  it('resend has a cooldown', async () => {
    const u = await createUser(app);
    await api().post('/api/v1/me/student-verification').set(u.auth).send({ collegeEmail: `a${Date.now()}@x.edu` }).expect(200);
    const again = await api().post('/api/v1/me/student-verification').set(u.auth).send({ collegeEmail: `b${Date.now()}@x.edu` }).expect(429);
    expect(again.body.error.code).toBe('AUTH_CODE_COOLDOWN');
  });
});

describe('categories (T2.3, FR-100, FR-104)', () => {
  it('public, grouped, and never includes gated care categories', async () => {
    const res = await api().get('/api/v1/categories').expect(200);
    const body = res.body as CategoriesResponse;
    const slugs = body.groups.flatMap((g) => g.categories.map((c) => c.slug));
    expect(slugs.length).toBe(39);
    expect(slugs).toContain('tailoring');
    for (const gated of ['babysitting', 'elder-care', 'pet-care']) expect(slugs).not.toContain(gated);
    expect(body.groups.map((g) => g.name)).not.toContain('Care');
    expect(res.headers['cache-control']).toContain('max-age=3600');
  });
});

describe('account deletion (T2.6, FR-009)', () => {
  async function createOpenOrder(buyer: TestUser, seller: TestUser) {
    const category = await prisma.category.findFirstOrThrow({ where: { sensitive: false } });
    const listing = await prisma.listing.create({
      data: {
        ownerId: seller.id,
        type: 'SERVICE_OFFER',
        categoryId: category.id,
        title: 'Test service',
        description: 'Test',
        pricingType: 'FIXED',
        pricePaise: 10_000,
        workMode: 'REMOTE',
        imageUrls: [],
      },
    });
    return prisma.order.create({
      data: {
        buyerId: buyer.id,
        sellerId: seller.id,
        listingId: listing.id,
        title: 'Test order',
        amountPaise: 10_000,
        paymentMode: 'DIRECT',
        status: 'IN_PROGRESS',
      },
    });
  }

  it('needs the password and no open orders; then anonymises, signs out and removes images', async () => {
    const u = await createUser(app, 'Leaving User');
    const viewer = await createUser(app);
    const avatarKey = await uploadImage(app, u, 'AVATAR');
    await api().patch('/api/v1/me').set(u.auth).send({ avatarUploadKey: avatarKey, bio: 'bye' }).expect(200);

    const wrong = await api().delete('/api/v1/me').set(u.auth).send({ password: 'not my password' }).expect(403);
    expect(wrong.body.error.code).toBe('AUTH_PASSWORD_INCORRECT');

    const order = await createOpenOrder(u, viewer);
    const blocked = await api().delete('/api/v1/me').set(u.auth).send({ password: TEST_PASSWORD }).expect(409);
    expect(blocked.body.error.code).toBe('ACCOUNT_HAS_OPEN_ORDERS');
    await prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } });

    await api().delete('/api/v1/me').set(u.auth).send({ password: TEST_PASSWORD }).expect(204);

    await api().get('/api/v1/me').set(u.auth).expect(401);
    await api().post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
    await api().post('/api/v1/auth/login').send({ email: u.email, password: TEST_PASSWORD }).expect(401);
    await api().get(`/api/v1/users/${u.id}`).set(viewer.auth).expect(404);
    await api().get(`/api/v1/uploads/files/${avatarKey}`).expect(404);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, include: { profile: true } });
    expect(row.status).toBe('DELETED');
    expect(row.email).not.toBe(u.email);
    expect(row.profile).toMatchObject({ displayName: 'Deleted user', bio: null, avatarUrl: null });
    // The completed order stays for the other party.
    expect(await prisma.order.count({ where: { id: order.id } })).toBe(1);

    // The email can be used for a new account.
    await api()
      .post('/api/v1/auth/signup')
      .send({ email: u.email, password: TEST_PASSWORD, displayName: 'New me', dateOfBirth: '2000-01-15', acceptTerms: true })
      .expect(201);
  });
});
