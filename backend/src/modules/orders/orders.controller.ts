/**
 * Orders (FR-400…409).
 *
 * | Endpoint                              | Who                          | Body / query           | Success |
 * |---------------------------------------|------------------------------|------------------------|---------|
 * | POST /orders                          | buyer (verified email)       | bookServiceSchema      | 201 OrderDetailDto (REQUESTED) |
 * | POST /quotes/:id/accept               | job owner (verified email)   | acceptQuoteSchema      | 201 OrderDetailDto |
 * | GET  /orders                          | participant                  | role, status?, cursor? | 200 Page<OrderSummaryDto> |
 * | GET  /orders/:id                      | buyer or seller              | —                      | 200 OrderDetailDto (actions, timeline, on-site codes for buyer) |
 * | POST /orders/:id/actions/:action      | per state machine            | orderActionBodySchema  | 200 OrderDetailDto |
 * | POST /orders/:id/start                | seller, on-site, in progress | { code }               | 200 OrderDetailDto |
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  acceptQuoteSchema,
  bookServiceSchema,
  idParamSchema,
  listOrdersSchema,
  orderActionBodySchema,
  startOrderSchema,
  userOrderActionSchema,
  type AcceptQuoteInput,
  type BookServiceInput,
  type ListOrdersInput,
  type OrderActionBody,
  type OrderDetailDto,
  type OrderSummaryDto,
  type Page,
  type StartOrderInput,
  type UserOrderAction,
} from '@cc/shared';
import { AuthRateLimit, CurrentUser, RequireVerifiedEmail, type AuthUser } from '../auth/auth.decorators.js';
import { OrdersService } from './orders.service.js';

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @RequireVerifiedEmail()
  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  book(@CurrentUser() user: AuthUser, @Body({ schema: bookServiceSchema }) body: BookServiceInput): Promise<OrderDetailDto> {
    return this.orders.book(user.id, body);
  }

  @RequireVerifiedEmail()
  @Post('quotes/:id/accept')
  @HttpCode(HttpStatus.CREATED)
  acceptQuote(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: idParamSchema }) quoteId: string,
    @Body({ schema: acceptQuoteSchema }) body: AcceptQuoteInput,
  ): Promise<OrderDetailDto> {
    return this.orders.acceptQuote(user.id, quoteId, body);
  }

  @Get('orders')
  list(@CurrentUser() user: AuthUser, @Query({ schema: listOrdersSchema }) query: ListOrdersInput): Promise<Page<OrderSummaryDto>> {
    return this.orders.list(user.id, query);
  }

  @Get('orders/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', { schema: idParamSchema }) id: string): Promise<OrderDetailDto> {
    return this.orders.getDetail(user.id, id);
  }

  @Post('orders/:id/actions/:action')
  @HttpCode(HttpStatus.OK)
  act(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: idParamSchema }) id: string,
    @Param('action', { schema: userOrderActionSchema }) action: UserOrderAction,
    @Body({ schema: orderActionBodySchema }) body: OrderActionBody,
  ): Promise<OrderDetailDto> {
    return this.orders.act(user.id, id, action, body ?? {});
  }

  /** Rate-limited: the 4-digit code must not be brute-forced. */
  @AuthRateLimit()
  @Post('orders/:id/start')
  @HttpCode(HttpStatus.OK)
  start(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: idParamSchema }) id: string,
    @Body({ schema: startOrderSchema }) body: StartOrderInput,
  ): Promise<OrderDetailDto> {
    return this.orders.start(user.id, id, body.code);
  }
}
