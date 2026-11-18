/**
 * /api/v1/conversations — chat between a buyer and a seller about a listing (FR-250…254).
 *
 * | Endpoint                               | Body / query           | Success |
 * |----------------------------------------|------------------------|---------|
 * | POST /conversations                    | { listingId }          | 200 ConversationDto (existing or new) |
 * | GET  /conversations                    | cursor?, limit?        | 200 Page<ConversationDto> (recent first, unread counts) |
 * | GET  /conversations/unread             | —                      | 200 UnreadSummaryDto |
 * | GET  /conversations/:id                | —                      | 200 ConversationDto |
 * | GET  /conversations/:id/messages       | cursor?, limit?        | 200 Page<MessageDto> (newest first) |
 * | POST /conversations/:id/messages       | { body }               | 201 MessageDto (+ socket message:new) |
 * | POST /conversations/:id/read           | —                      | 200 ConversationReadEvent |
 * Non-participants get 404 CONVERSATION_NOT_FOUND. Blocked pairs get 403 USER_BLOCKED when sending.
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  idParamSchema,
  pageQuerySchema,
  sendMessageSchema,
  startConversationSchema,
  type ConversationDto,
  type ConversationReadEvent,
  type MessageDto,
  type Page,
  type PageQuery,
  type SendMessageInput,
  type StartConversationInput,
  type UnreadSummaryDto,
} from '@cc/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { ConversationsService } from './conversations.service.js';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  start(@CurrentUser() user: AuthUser, @Body({ schema: startConversationSchema }) body: StartConversationInput): Promise<ConversationDto> {
    return this.conversations.start(user.id, body.listingId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query({ schema: pageQuerySchema }) query: PageQuery): Promise<Page<ConversationDto>> {
    return this.conversations.list(user.id, query);
  }

  @Get('unread')
  unread(@CurrentUser() user: AuthUser): Promise<UnreadSummaryDto> {
    return this.conversations.unreadSummary(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', { schema: idParamSchema }) id: string): Promise<ConversationDto> {
    return this.conversations.getOne(user.id, id);
  }

  @Get(':id/messages')
  messages(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: idParamSchema }) id: string,
    @Query({ schema: pageQuerySchema }) query: PageQuery,
  ): Promise<Page<MessageDto>> {
    return this.conversations.messages(user.id, id, query);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: idParamSchema }) id: string,
    @Body({ schema: sendMessageSchema }) body: SendMessageInput,
  ): Promise<MessageDto> {
    return this.conversations.send(user.id, id, body.body);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  read(@CurrentUser() user: AuthUser, @Param('id', { schema: idParamSchema }) id: string): Promise<ConversationReadEvent> {
    return this.conversations.markRead(user.id, id);
  }
}
