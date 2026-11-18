/**
 * Notifications (FR-550) and push tokens (FR-551).
 *
 *   GET    /notifications               cursor?, limit? → Page<NotificationDto> + unreadCount
 *   GET    /notifications/unread-count  → { unreadCount }
 *   POST   /notifications/read          { ids? } (omit = all) → { unreadCount }
 *   POST   /me/push-tokens              { token, platform? } → 204
 *   DELETE /me/push-tokens              { token } → 204 (call on sign-out)
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  markNotificationsReadSchema,
  pageQuerySchema,
  pushTokenSchema,
  type MarkNotificationsReadInput,
  type NotificationDto,
  type Page,
  type PageQuery,
  type PushTokenInput,
} from '@cc/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { NotificationsService } from './notifications.service.js';

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  list(@CurrentUser() user: AuthUser, @Query({ schema: pageQuerySchema }) query: PageQuery): Promise<Page<NotificationDto> & { unreadCount: number }> {
    return this.notifications.list(user.id, query);
  }

  @Get('notifications/unread-count')
  async unread(@CurrentUser() user: AuthUser): Promise<{ unreadCount: number }> {
    return { unreadCount: await this.notifications.unreadCount(user.id) };
  }

  @Post('notifications/read')
  @HttpCode(HttpStatus.OK)
  read(@CurrentUser() user: AuthUser, @Body({ schema: markNotificationsReadSchema }) body: MarkNotificationsReadInput): Promise<{ unreadCount: number }> {
    return this.notifications.markRead(user.id, body.ids);
  }

  @Post('me/push-tokens')
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(@CurrentUser() user: AuthUser, @Body({ schema: pushTokenSchema }) body: PushTokenInput): Promise<void> {
    await this.notifications.registerPushToken(user.id, body);
  }

  @Delete('me/push-tokens')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregister(@CurrentUser() user: AuthUser, @Body({ schema: pushTokenSchema }) body: PushTokenInput): Promise<void> {
    await this.notifications.removePushToken(user.id, body.token);
  }
}
