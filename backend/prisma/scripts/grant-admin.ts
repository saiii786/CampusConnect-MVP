/**
 * Give (or remove) the ADMIN role for an existing account. There is deliberately no API for this.
 *
 *   npm run admin:grant -w @cc/backend -- someone@example.com
 *   npm run admin:grant -w @cc/backend -- someone@example.com --revoke
 *
 * Uses DIRECT_URL / DATABASE_URL from backend/.env — check which database you are pointing at.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { pgOptions } from '../../src/prisma/pg-options.js';

const [email, flag] = process.argv.slice(2);
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!email || !url) {
  console.error('Usage: npm run admin:grant -w @cc/backend -- <email> [--revoke]   (needs DATABASE_URL)');
  process.exit(1);
}

// Same TLS handling as the API: verified when DATABASE_CA_CERT_PATH is set (Supabase, ADR-031).
const prisma = new PrismaClient({ adapter: new PrismaPg(pgOptions(url, process.env.DATABASE_CA_CERT_PATH)) });
try {
  const role = flag === '--revoke' ? 'USER' : 'ADMIN';
  const result = await prisma.user.updateMany({ where: { email: email.trim().toLowerCase() }, data: { role } });
  if (result.count === 0) {
    console.error(`No account with email ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`${email} is now ${role}`);
  }
} finally {
  await prisma.$disconnect();
}
