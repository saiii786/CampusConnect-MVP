/**
 * Read-only database check: runs a few queries through the app's own Prisma client and driver adapter
 * (the same path the API uses). Useful to test a new connection string, e.g. Supabase's pooler.
 *
 *   DATABASE_URL=<url> npm run db:check -w @cc/backend
 *
 * Never writes. Prints only counts, never the URL.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  const started = Date.now();
  // Repeated and parallel queries: catches poolers that break prepared statements (transaction mode).
  for (let round = 0; round < 3; round++) {
    const [categories, users, listings] = await Promise.all([
      prisma.category.count(),
      prisma.user.count(),
      prisma.listing.count({ where: { deletedAt: null } }),
    ]);
    if (round === 2) console.log(JSON.stringify({ ok: true, categories, users, listings, ms: Date.now() - started }));
  }
  await prisma.category.findMany({ take: 3, select: { slug: true } });
} catch (error) {
  console.error('DB CHECK FAILED:', (error as Error).message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
