/**
 * Root module: wires configuration, database, cross-cutting concerns and feature modules.
 * Feature modules are added here as each roadmap phase is built (docs/ROADMAP.md).
 *
 * Global guards run in this order: ThrottlerGuard (rate limits) → AuthGuard (sign-in, roles).
 */
import { Module, type DynamicModule, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { AppThrottlerGuard } from './common/http/app-throttler.guard.js';
import { RequestContextMiddleware } from './common/http/request-context.middleware.js';
import { createValidationPipe } from './common/validation/validation.pipe.js';
import { ConfigModule } from './config/config.module.js';
import type { AppEnv } from './config/env.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { hasAuthRateLimit } from './modules/auth/auth.decorators.js';
import { AuthGuard } from './modules/auth/auth.guard.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { ConversationsModule } from './modules/conversations/conversations.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ListingsModule } from './modules/listings/listings.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { QuotesModule } from './modules/quotes/quotes.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { SafetyModule } from './modules/safety/safety.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';
import { UsersModule } from './modules/users/users.module.js';
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
        MailModule,
        ThrottlerModule.forRoot({
          throttlers: [
            // Every route, per IP (FR-603). Opt out with @SkipThrottle().
            { name: 'default', ttl: 60_000, limit: env.RATE_LIMIT_PER_MINUTE },
            // Additional stricter limit, only on routes marked @AuthRateLimit().
            {
              name: 'auth',
              ttl: 60_000,
              limit: env.AUTH_RATE_LIMIT_PER_MINUTE,
              skipIf: (context) => !hasAuthRateLimit(context),
            },
          ],
        }),
        StorageModule,
        HealthModule,
        AuthModule,
        UploadsModule,
        UsersModule,
        CategoriesModule,
        ListingsModule,
        RealtimeModule,
        SafetyModule,
        ConversationsModule,
        QuotesModule,
        OrdersModule,
        AdminModule,
      ],
      providers: [
        { provide: APP_PIPE, useFactory: createValidationPipe },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_GUARD, useClass: AppThrottlerGuard },
        { provide: APP_GUARD, useExisting: AuthGuard },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
