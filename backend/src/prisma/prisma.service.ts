/**
 * The single database client for the app (Prisma 7 + node-postgres driver adapter).
 *
 * Inject it anywhere: `constructor(private readonly prisma: PrismaService) {}`.
 * Uses DATABASE_URL (Supabase pooled connection in production).
 */
import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { APP_ENV } from '../config/config.module.js';
import type { AppEnv } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(APP_ENV) env: AppEnv) {
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  }

  /** True if the database answers a trivial query (used by /health). */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.warn(`Database health check failed: ${(error as Error).message}`);
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
