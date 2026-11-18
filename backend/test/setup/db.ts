/**
 * Test-database helpers. Only ever used against the TEST database (see test-env.ts / global-setup.ts).
 */
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { CATEGORY_SEED } from '../../prisma/seed-data/categories.js';

/**
 * Remove all user-generated data. TRUNCATE "User" CASCADE also empties every table that
 * references users (profiles, tokens, wallets, listings, orders…). Reference data seeded by
 * migrations/seed (categories, student domains) is kept.
 */
export async function resetUserData(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
}

/** Same upsert as prisma/seed.ts, so tests see the real category tree. */
export async function seedCategories(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  for (const [position, c] of CATEGORY_SEED.entries()) {
    const data = { name: c.name, groupName: c.groupName, sensitive: c.sensitive ?? false, position };
    await prisma.category.upsert({ where: { slug: c.slug }, update: data, create: { slug: c.slug, ...data } });
  }
}
