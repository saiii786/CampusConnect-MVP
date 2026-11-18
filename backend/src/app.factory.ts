/**
 * Creates and configures the Nest application. Shared by main.ts (real server) and the
 * integration tests, so tests run against exactly the same setup as production.
 */
import { ConsoleLogger, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import type { AppEnv } from './config/env.js';

export const API_PREFIX = 'api/v1';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'] as const;

export async function createApp(env: AppEnv): Promise<INestApplication> {
  const levels = LOG_LEVELS.slice(0, LOG_LEVELS.indexOf(env.LOG_LEVEL) + 1);
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), {
    logger: new ConsoleLogger({ json: env.LOG_JSON, logLevels: [...levels] }),
  });

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  // Real client IP behind Render's proxy (needed for per-IP rate limiting).
  app.set('trust proxy', 1);
  // JSON bodies only, capped to stop oversized payloads. Images go straight to storage.
  app.useBodyParser('json', { limit: '100kb' });
  app.enableCors({ origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : false });
  app.enableShutdownHooks();
  return app;
}
