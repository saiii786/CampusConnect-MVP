/**
 * Makes the validated environment available everywhere via dependency injection:
 *
 *   constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}
 *
 * Global module, so feature modules do not need to import it.
 */
import { Global, Module, type DynamicModule } from '@nestjs/common';
import type { AppEnv } from './env.js';

export const APP_ENV = Symbol('APP_ENV');

@Global()
@Module({})
export class ConfigModule {
  static forRoot(env: AppEnv): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_ENV, useValue: env }],
      exports: [APP_ENV],
    };
  }
}
