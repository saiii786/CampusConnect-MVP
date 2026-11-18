/**
 * Provides `MailService` globally, choosing the driver from `MAIL_DRIVER`.
 */
import { Global, Module } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';
import { ConsoleMailService, MailService } from './mail.service.js';

@Global()
@Module({
  providers: [
    {
      provide: MailService,
      inject: [APP_ENV],
      useFactory: (env: AppEnv): MailService => {
        switch (env.MAIL_DRIVER) {
          case 'console':
            return new ConsoleMailService();
        }
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
