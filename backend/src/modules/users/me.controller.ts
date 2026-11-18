/**
 * /api/v1/me — the signed-in user's own account.
 * Phase 1: GET /me (used by the app to restore a session). Phase 2 adds PATCH/DELETE /me,
 * student verification and portfolio (ROADMAP T2.x).
 */
import { Controller, Get } from '@nestjs/common';
import type { MeResponse } from '@cc/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { AuthService } from '../auth/auth.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.auth.me(user.id);
  }
}
