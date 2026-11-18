/**
 * Notifications module — global so any feature can call NotificationsService.notify().
 */
import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { PUSH_FETCH, PushService } from './push.service.js';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushService,
    { provide: PUSH_FETCH, useValue: (...args: Parameters<typeof fetch>) => fetch(...args) },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
