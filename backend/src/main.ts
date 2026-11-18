/**
 * Server entry point. Loads .env (development only), validates configuration — exiting with
 * a clear message if anything is wrong — then starts the HTTP server.
 */
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { createApp } from './app.factory.js';
import { InvalidEnvironmentError, loadEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  let env;
  try {
    env = loadEnv();
  } catch (error) {
    if (error instanceof InvalidEnvironmentError) {
      console.error(`\n${error.message}\n\nSee backend/.env.example for every required variable.\n`);
      process.exit(1);
    }
    throw error;
  }

  const app = await createApp(env);
  await app.listen(env.PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
}

await bootstrap();
