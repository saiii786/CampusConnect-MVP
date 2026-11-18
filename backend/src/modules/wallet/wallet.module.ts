/**
 * Wallet module: balances, history, withdrawals, escrow (as the orders' ORDER_MONEY).
 */
import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { LedgerModule } from './ledger.module.js';
import { WalletController } from './wallet.controller.js';
import { WalletService } from './wallet.service.js';

@Module({
  imports: [LedgerModule, PaymentsModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService, LedgerModule],
})
export class WalletModule {}
