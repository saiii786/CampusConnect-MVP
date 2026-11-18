/**
 * Admin module (FR-601). Every controller here is `@Roles('ADMIN')`.
 *   Phase 2: student domains · Phase 6: ledger reconciliation ·
 *   Phase 8: reports, suspensions, disputes, run scheduled jobs.
 * Make someone an admin with: npm run admin:grant -w @cc/backend -- <email>
 */
import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { SafetyModule } from '../safety/safety.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { AdminDisputesController } from './admin-disputes.controller.js';
import { AdminJobsController } from './admin-jobs.controller.js';
import { AdminSafetyController } from './admin-safety.controller.js';
import { AdminLedgerController } from './ledger.controller.js';
import { StudentDomainsController } from './student-domains.controller.js';

@Module({
  imports: [WalletModule, SafetyModule, OrdersModule, JobsModule],
  controllers: [StudentDomainsController, AdminLedgerController, AdminSafetyController, AdminDisputesController, AdminJobsController],
})
export class AdminModule {}
