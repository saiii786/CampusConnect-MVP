/**
 * Admin module (FR-601). Every controller here is `@Roles('ADMIN')`.
 * Phase 2: student domains. Phase 8 adds reports, suspensions, disputes, ledger reconcile.
 * Make someone an admin with: npm run admin:grant -w @cc/backend -- <email>
 */
import { Module } from '@nestjs/common';
import { StudentDomainsController } from './student-domains.controller.js';

@Module({
  controllers: [StudentDomainsController],
})
export class AdminModule {}
