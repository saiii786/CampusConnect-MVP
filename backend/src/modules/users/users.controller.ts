/**
 * /api/v1/users/:id — another user's public profile (FR-052, FR-054). Signed-in users only
 * (the shareable no-login page is the work record, Phase 7). Unknown, suspended or deleted → 404.
 */
import { Controller, Get, Param } from '@nestjs/common';
import { idParamSchema, type PublicProfile } from '@cc/shared';
import { ProfileService } from './profile.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly profiles: ProfileService) {}

  @Get(':id')
  get(@Param('id', { schema: idParamSchema }) id: string): Promise<PublicProfile> {
    return this.profiles.getPublicProfile(id);
  }
}
