/**
 * Orders module. `ORDER_MONEY` (the escrow hook, ADR-023) is the WalletService since Phase 6.
 */
import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { SafetyModule } from '../safety/safety.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { WalletService } from '../wallet/wallet.service.js';
import { OrdersController } from './orders.controller.js';
import { ORDER_MONEY, OrdersService } from './orders.service.js';

@Module({
  imports: [ConversationsModule, SafetyModule, WalletModule],
  controllers: [OrdersController],
  providers: [OrdersService, { provide: ORDER_MONEY, useExisting: WalletService }],
  exports: [OrdersService],
})
export class OrdersModule {}
