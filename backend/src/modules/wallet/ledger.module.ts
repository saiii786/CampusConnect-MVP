/**
 * Provides the single LedgerService (the only code that moves money) to wallet, payments and admin.
 */
import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service.js';

@Module({
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
