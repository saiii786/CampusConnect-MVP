/**
 * Reviews (FR-500…502) and the verified work record (FR-053).
 *
 * | Endpoint                         | Who          | Body / query        | Success |
 * |----------------------------------|--------------|---------------------|---------|
 * | POST /orders/:id/review          | participant  | { rating, comment? }| 201 ReviewDto |
 * | POST /reviews/:id/reply          | reviewee     | { reply }           | 200 ReviewDto |
 * | GET  /users/:id/reviews          | signed in    | cursor?, limit?     | 200 Page<ReviewDto> |
 * | GET  /users/:id/work-record      | PUBLIC       | —                   | 200 WorkRecordDto |
 * | GET  /work-record/:id            | PUBLIC       | —                   | 200 HTML page (shareable link for a CV) |
 */
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  createReviewSchema,
  idParamSchema,
  pageQuerySchema,
  replyReviewSchema,
  type CreateReviewInput,
  type Page,
  type PageQuery,
  type ReplyReviewInput,
  type ReviewDto,
  type WorkRecordDto,
} from '@cc/shared';
import { CurrentUser, Public, type AuthUser } from '../auth/auth.decorators.js';
import { ReviewsService } from './reviews.service.js';
import { renderWorkRecordPage } from './work-record.page.js';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('orders/:id/review')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: idParamSchema }) orderId: string,
    @Body({ schema: createReviewSchema }) body: CreateReviewInput,
  ): Promise<ReviewDto> {
    return this.reviews.create(user.id, orderId, body);
  }

  @Post('reviews/:id/reply')
  @HttpCode(HttpStatus.OK)
  reply(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: idParamSchema }) reviewId: string,
    @Body({ schema: replyReviewSchema }) body: ReplyReviewInput,
  ): Promise<ReviewDto> {
    return this.reviews.reply(user.id, reviewId, body);
  }

  @Get('users/:id/reviews')
  list(@Param('id', { schema: idParamSchema }) userId: string, @Query({ schema: pageQuerySchema }) query: PageQuery): Promise<Page<ReviewDto>> {
    return this.reviews.listForUser(userId, query);
  }

  @Public()
  @Get('users/:id/work-record')
  workRecord(@Param('id', { schema: idParamSchema }) userId: string): Promise<WorkRecordDto> {
    return this.reviews.workRecord(userId);
  }

  @Public()
  @Get('work-record/:id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  async workRecordPage(@Param('id', { schema: idParamSchema }) userId: string): Promise<string> {
    return renderWorkRecordPage(await this.reviews.workRecord(userId));
  }
}
