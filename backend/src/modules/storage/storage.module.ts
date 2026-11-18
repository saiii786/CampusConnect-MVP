/**
 * Provides `StorageService` globally, choosing the driver from STORAGE_DRIVER.
 * `LocalStorageService` is also provided by its own class so the local upload routes can use it.
 */
import { Global, Module } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';
import { LocalStorageService } from './local-storage.service.js';
import { StorageService } from './storage.service.js';
import { SUPABASE_FETCH, SupabaseStorageService } from './supabase-storage.service.js';

@Global()
@Module({
  providers: [
    LocalStorageService,
    { provide: SUPABASE_FETCH, useValue: (...args: Parameters<typeof fetch>) => fetch(...args) },
    {
      provide: StorageService,
      inject: [APP_ENV, LocalStorageService, SUPABASE_FETCH],
      useFactory: (env: AppEnv, local: LocalStorageService, fetchImpl: typeof fetch): StorageService =>
        env.STORAGE_DRIVER === 'supabase' ? new SupabaseStorageService(env, fetchImpl) : local,
    },
  ],
  exports: [StorageService, LocalStorageService],
})
export class StorageModule {}
