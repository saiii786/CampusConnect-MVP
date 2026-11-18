/**
 * Quotes (FR-200…203).
 *
 * | Endpoint                       | Who                         | Body                | Success |
 * |--------------------------------|-----------------------------|---------------------|---------|
 * | POST /listings/:id/quotes      | seller (verified email)     | createQuoteSchema   | 201 QuoteDto (+ chat message) |
 * | GET  /listings/:id/quotes      | job owner                   | —                   | 200 QuoteDto[] (ACTIVE first, cheapest first) |
 * | GET  /me/quotes                | seller                      | —                   | 200 MyQuoteDto[] |
 * | PATCH /quotes/:id              | seller, quote ACTIVE        | updateQuoteSchema   | 200 QuoteDto |
 * | POST /quotes/:id/withdraw      | seller, quote ACTIVE        | —                   | 200 QuoteDto |
 * | POST /quotes/:id/reject        | job owner, quote ACTIVE     | —                   | 200 QuoteDto |
 * Accepting a quote (→ order) is POST /quotes/:id/accept in Phase 5.
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import {
  createQuoteSchema,
  idParamSchema,
  updateQuoteSchema,
  type CreateQuoteInput,
  type MyQuoteDto,
  type QuoteDto,
  type UpdateQuoteInput,
} from '@cc/shared';
import { CurrentUser, RequireVerifiedEmail, type AuthUser } from '../auth/auth.decorators.js';
import { QuotesService } from './quotes.service.js';

@Controller()
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @RequireVerifiedEmail()
  @Post('listings/:id/quotes')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: idParamSchema }) listingId: string,
    @Body({ schema: createQuoteSchema }) body: CreateQuoteInput,
  ): Promise<QuoteDto> {
    return this.quotes.create(user.id, listingId, body);
  }

  @Get('listings/:id/quotes')
  forListing(@CurrentUser() user: AuthUser, @Param('id', { schema: idParamSchema }) listingId: string): Promise<QuoteDto[]> {
    return this.quotes.listForListing(user.id, listingId);
  }

  @Get('me/quotes')
  mine(@CurrentUser() user: AuthUser): Promise<MyQuoteDto[]> {
    return this.quotes.mine(user.id);
  }

  @Patch('quotes/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: idParamSchema }) id: string,
    @Body({ schema: updateQuoteSchema }) body: UpdateQuoteInput,
  ): Promise<QuoteDto> {
    return this.quotes.update(user.id, id, body);
  }

  @Post('quotes/:id/withdraw')
  @HttpCode(HttpStatus.OK)
  withdraw(@CurrentUser() user: AuthUser, @Param('id', { schema: idParamSchema }) id: string): Promise<QuoteDto> {
    return this.quotes.withdraw(user.id, id);
  }

  @Post('quotes/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() user: AuthUser, @Param('id', { schema: idParamSchema }) id: string): Promise<QuoteDto> {
    return this.quotes.reject(user.id, id);
  }
}
