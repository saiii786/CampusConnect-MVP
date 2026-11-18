/**
 * Orders module. `ORDER_MONEY` is the escrow hook: until the wallet module (Phase 6) provides a
 * real implementation, escrow is disabled and only DIRECT (pay outside the app) orders exist.
 */
import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { SafetyModule } from '../safety/safety.module.js';
import { OrdersController } from './orders.controller.js';
import { ORDER_MONEY, OrdersService, type OrderMoney } from './orders.service.js';

const noEscrow: OrderMoney = {
  escrowEnabled: false,
  apply: () => Promise.reject(new Error('Escrow is not available before the wallet module (Phase 6)')),
};

@Module({
  imports: [ConversationsModule, SafetyModule],
  controllers: [OrdersController],
  providers: [OrdersService, { provide: ORDER_MONEY, useValue: noEscrow }],
  exports: [OrdersService],
})
export class OrdersModule {}
