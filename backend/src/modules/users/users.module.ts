/**
 * Users module: the signed-in user's account (/me). Public profiles (/users/:id) arrive in Phase 2.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MeController } from './me.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [MeController],
})
export class UsersModule {}
