/**
 * /api/v1/blocks — block and unblock people (FR-253). Reports (FR-600) arrive in Phase 8.
 *
 *   GET    /blocks            → BlockedUserDto[] (people I blocked)
 *   POST   /blocks            { userId } → 204 (idempotent)
 *   DELETE /blocks/:userId    → 204 (idempotent)
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { blockUserSchema, idParamSchema, type BlockedUserDto, type BlockUserInput } from '@cc/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { BlocksService } from './blocks.service.js';

@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<BlockedUserDto[]> {
    return this.blocks.list(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async block(@CurrentUser() user: AuthUser, @Body({ schema: blockUserSchema }) body: BlockUserInput): Promise<void> {
    await this.blocks.block(user.id, body.userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblock(@CurrentUser() user: AuthUser, @Param('userId', { schema: idParamSchema }) userId: string): Promise<void> {
    await this.blocks.unblock(user.id, userId);
  }
}
