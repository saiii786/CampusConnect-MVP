/**
 * Root module: wires configuration, database, cross-cutting concerns and feature modules.
 * Feature modules are added here as each roadmap phase is built (docs/ROADMAP.md).
 */
import { Module, type DynamicModule, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { RequestContextMiddleware } from './common/http/request-context.middleware.js';
import { createValidationPipe } from './common/validation/validation.pipe.js';
import { ConfigModule } from './config/config.module.js';
import type { AppEnv } from './config/env.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({})
export class AppModule implements NestModule {
  /** Built from the validated environment so tests can pass their own config. */
  static forRoot(env: AppEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        PrismaModule,
        // Default rate limit for every route (FR-603). Stricter limits are set per route.
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', ttl: 60_000, limit: env.RATE_LIMIT_PER_MINUTE }],
        }),
        HealthModule,
      ],
      providers: [
        { provide: APP_PIPE, useFactory: createValidationPipe },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
