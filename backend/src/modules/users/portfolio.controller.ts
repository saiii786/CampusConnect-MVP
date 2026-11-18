/**
 * /api/v1/me/portfolio — the signed-in user's portfolio (FR-051, max 10 items).
 *
 * | Endpoint                    | Body                          | Success |
 * |-----------------------------|-------------------------------|---------|
 * | GET    /me/portfolio        | —                             | 200 PortfolioItemDto[] (in display order) |
 * | POST   /me/portfolio        | createPortfolioItemSchema     | 201 PortfolioItemDto · 422 PORTFOLIO_LIMIT |
 * | PATCH  /me/portfolio/:id    | updatePortfolioItemSchema     | 200 PortfolioItemDto |
 * | DELETE /me/portfolio/:id    | —                             | 204 |
 * Other users' items → 404 PORTFOLIO_ITEM_NOT_FOUND.
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import {
  createPortfolioItemSchema,
  idParamSchema,
  updatePortfolioItemSchema,
  type CreatePortfolioItemInput,
  type PortfolioItemDto,
  type UpdatePortfolioItemInput,
} from '@cc/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { PortfolioService } from './portfolio.service.js';

@Controller('me/portfolio')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<PortfolioItemDto[]> {
    return this.portfolio.list(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createPortfolioItemSchema }) body: CreatePortfolioItemInput,
  ): Promise<PortfolioItemDto> {
    return this.portfolio.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: idParamSchema }) id: string,
    @Body({ schema: updatePortfolioItemSchema }) body: UpdatePortfolioItemInput,
  ): Promise<PortfolioItemDto> {
    return this.portfolio.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', { schema: idParamSchema }) id: string): Promise<void> {
    await this.portfolio.remove(user.id, id);
  }
}
