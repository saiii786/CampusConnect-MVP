/**
 * Admin module (FR-601). Every controller here is `@Roles('ADMIN')`.
 * Phase 2: student domains. Phase 6: ledger reconciliation. Phase 8 adds reports, suspensions, disputes.
 * Make someone an admin with: npm run admin:grant -w @cc/backend -- <email>
 */
import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module.js';
import { AdminLedgerController } from './ledger.controller.js';
import { StudentDomainsController } from './student-domains.controller.js';

@Module({
  imports: [WalletModule],
  controllers: [StudentDomainsController, AdminLedgerController],
})
export class AdminModule {}
