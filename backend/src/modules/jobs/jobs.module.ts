/**
 * Scheduled jobs module (auto-approve). Exports JobsService for the admin "run now" endpoint.
 */
import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { JobsService } from './jobs.service.js';

@Module({
  imports: [OrdersModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
