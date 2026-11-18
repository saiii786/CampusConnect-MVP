/**
 * Load test (ROADMAP T9.4, NFR-03: p95 < 300 ms). No extra tools needed â€” plain fetch with N workers.
 *
 *   npm run load:test -w @cc/backend -- --base http://localhost:3001 [--listings 20000] [--seconds 15] [--workers 20]
 *
 * SAFETY: it writes thousands of fake rows, so it refuses to run unless DATABASE_URL points at a database whose
 * name ends in `_load` (create one next to your dev database â€” see docs/DEV_LOG.md, Phase 9). The API under test
 * must use the same database and a high RATE_LIMIT_PER_MINUTE, or most requests get 429.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const base = arg('base', 'http://localhost:3001') + '/api/v1';
const targetListings = Number(arg('listings', '20000'));
const seconds = Number(arg('seconds', '15'));
const workers = Number(arg('workers', '20'));

const url = process.env.DATABASE_URL ?? '';
const dbName = new URL(url).pathname.slice(1);
if (!dbName.endsWith('_load')) {
  console.error(`Refusing to seed database "${dbName}": the load test only runs against a database named *_load.`);
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// â”€â”€ 1. Seed realistic data (idempotent: tops up to the target count) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CITIES = [
  { city: 'Hyderabad', lat: 17.385, lng: 78.4867 },
  { city: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { city: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { city: 'Pune', lat: 18.5204, lng: 73.8567 },
  { city: 'Delhi', lat: 28.6139, lng: 77.209 },
];
const WORDS = ['python', 'tutor', 'logo', 'design', 'video', 'editing', 'resume', 'excel', 'react', 'website',
  'maths', 'physics', 'photography', 'event', 'helper', 'translation', 'telugu', 'hindi', 'poster', 'assignment'];
const pick = <T>(xs: readonly T[], i: number): T => xs[i % xs.length]!;

async function seed() {
  const have = await prisma.listing.count();
  if (have >= targetListings) return console.log(`seed: ${have} listings already present`);
  const categories = await prisma.category.findMany({ select: { id: true } });
  if (categories.length === 0) throw new Error('No categories â€” run `npm run db:seed` against the _load database first');
  const owners: string[] = [];
  for (let i = 0; i < 200; i++) {
    const email = `load-owner-${i}@example.invalid`;
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email, passwordHash: 'not-a-real-hash', emailVerifiedAt: new Date(), dateOfBirth: new Date('2002-01-01'),
        termsAcceptedAt: new Date(), profile: { create: { displayName: `Load Owner ${i}`, skills: [], languages: [] } },
      },
    });
    owners.push(u.id);
  }
  for (let start = have; start < targetListings; start += 1000) {
    const data = Array.from({ length: Math.min(1000, targetListings - start) }, (_, k) => {
      const i = start + k;
      const offer = i % 2 === 0;
      const onsite = i % 3 === 0;
      const c = pick(CITIES, i);
      return {
        ownerId: pick(owners, i), type: offer ? 'SERVICE_OFFER' as const : 'JOB_REQUEST' as const,
        categoryId: pick(categories, i * 7).id,
        title: `${pick(WORDS, i)} ${pick(WORDS, i * 3 + 1)} ${offer ? 'service' : 'needed'} #${i}`,
        description: `Load test listing ${i}: ${pick(WORDS, i * 5)} ${pick(WORDS, i * 11)} ${pick(WORDS, i * 13)} for students.`,
        pricingType: offer ? 'FIXED' as const : 'QUOTE' as const,
        pricePaise: offer ? 10_000 + (i % 500) * 100 : null,
        budgetMinPaise: offer ? null : 20_000, budgetMaxPaise: offer ? null : 80_000,
        workMode: onsite ? 'ONSITE' as const : 'REMOTE' as const,
        city: onsite ? c.city : null,
        lat: onsite ? c.lat + ((i % 97) - 48) / 1000 : null, lng: onsite ? c.lng + ((i % 89) - 44) / 1000 : null,
        radiusKm: onsite ? 10 : null, imageUrls: [], imageKeys: [],
      };
    });
    await prisma.listing.createMany({ data });
  }
  console.log(`seed: ${await prisma.listing.count()} listings`);
}

// â”€â”€ 2. Load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function json(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} â†’ ${res.status} ${await res.text()}`);
  return res.json() as Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

async function run(name: string, path: string, token?: string) {
  const latencies: number[] = [];
  let errors = 0;
  const statuses = new Map<number, number>();
  const end = Date.now() + seconds * 1000;
  await Promise.all(Array.from({ length: workers }, async () => {
    while (Date.now() < end) {
      const t = performance.now();
      try {
        const res = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        await res.arrayBuffer();
        latencies.push(performance.now() - t);
        if (!res.ok) { errors++; statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1); }
      } catch { errors++; }
    }
  }));
  latencies.sort((a, b) => a - b);
  const p = (q: number) => latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))]?.toFixed(0);
  const row = { name, requests: latencies.length, rps: Math.round(latencies.length / seconds), p50: p(0.5), p95: p(0.95), p99: p(0.99), errors,
    ...(statuses.size ? { statuses: Object.fromEntries(statuses) } : {}) };
  console.log(JSON.stringify(row));
  return row;
}

try {
  await seed();
  const email = `load-user-${Date.now()}@example.invalid`;
  const s = await json('POST', '/auth/signup', { email, password: 'load test password', displayName: 'Load User', dateOfBirth: '2001-05-05', acceptTerms: true });
  const token: string = s.tokens.accessToken;
  const cats = await json('GET', '/categories', undefined, token);
  const categoryId: string = cats.groups[0].categories[0].id;
  const anyListing = (await json('GET', '/listings?limit=1', undefined, token)).items[0].id as string;

  console.log(`load: ${workers} concurrent workers Ã— ${seconds}s per endpoint against ${base}`);
  const rows = [];
  rows.push(await run('health', '/health', token));
  rows.push(await run('categories', '/categories', token));
  rows.push(await run('browse newest', '/listings', token));
  rows.push(await run('browse services', '/listings?type=SERVICE_OFFER', token));
  rows.push(await run('text search (2 words)', '/listings?q=python%20tutor', token));
  rows.push(await run('text search (no match)', '/listings?q=zzqx', token));
  rows.push(await run('category + price sort', `/listings?categoryId=${categoryId}&sort=price_asc`, token));
  rows.push(await run('near me 10 km', '/listings?lat=17.385&lng=78.4867&radiusKm=10&sort=distance', token));
  rows.push(await run('listing detail', `/listings/${anyListing}`, token));
  rows.push(await run('me (signed in)', '/me', token));
  rows.push(await run('conversations (signed in)', '/conversations', token));
  rows.push(await run('unread notifications', '/notifications/unread-count', token));
  const worst = rows.reduce((a, b) => (Number(b.p95) > Number(a.p95) ? b : a));
  const failed = rows.filter((r) => r.errors > 0);
  console.log(`\nworst p95: ${worst.p95} ms (${worst.name}) â€” target < 300 ms â†’ ${Number(worst.p95) < 300 ? 'PASS' : 'FAIL'}`);
  if (failed.length) console.log(`endpoints with errors: ${failed.map((r) => r.name).join(', ')}`);
  if (Number(worst.p95) >= 300 || failed.length) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
