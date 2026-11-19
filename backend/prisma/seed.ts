/**
 * Seeds reference data. Idempotent: safe to run any number of times (`npm run db:seed`).
 * Only reference data lives here — never fake users or fake listings.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { pgOptions } from '../src/prisma/pg-options.js';
import { CATEGORY_SEED } from './seed-data/categories.js';

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Seed: DIRECT_URL or DATABASE_URL must be set');
  process.exit(1);
}

// Verified TLS when DATABASE_CA_CERT_PATH is set (Supabase, ADR-031).
const prisma = new PrismaClient({ adapter: new PrismaPg(pgOptions(url, process.env.DATABASE_CA_CERT_PATH)) });

async function main(): Promise<void> {
  for (const [position, c] of CATEGORY_SEED.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, groupName: c.groupName, sensitive: c.sensitive ?? false, position },
      create: { slug: c.slug, name: c.name, groupName: c.groupName, sensitive: c.sensitive ?? false, position },
    });
  }
  console.log(`Seed: ${CATEGORY_SEED.length} categories upserted`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
