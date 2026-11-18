/**
 * Quotes module (Mode 1). Exports QuotesService for orders (Phase 5: accept a quote).
 */
import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { SafetyModule } from '../safety/safety.module.js';
import { UsersModule } from '../users/users.module.js';
import { QuotesController } from './quotes.controller.js';
import { QuotesService } from './quotes.service.js';

@Module({
  imports: [ConversationsModule, SafetyModule, UsersModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
