/**
 * Conversations module (chat). Exports ConversationsService for quotes/orders.
 */
import { Module } from '@nestjs/common';
import { SafetyModule } from '../safety/safety.module.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';

@Module({
  imports: [SafetyModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
