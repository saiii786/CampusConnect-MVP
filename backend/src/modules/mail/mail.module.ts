/**
 * Provides `MailService` globally, choosing the driver from `MAIL_DRIVER`.
 */
import { Global, Module } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';
import { BrevoMailService } from './brevo-mail.service.js';
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
          case 'brevo':
            // env.ts guarantees these are set when MAIL_DRIVER=brevo.
            return new BrevoMailService({ apiKey: env.BREVO_API_KEY!, fromEmail: env.MAIL_FROM_EMAIL!, fromName: env.MAIL_FROM_NAME });
        }
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
