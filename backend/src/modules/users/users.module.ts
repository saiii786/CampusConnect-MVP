/**
 * Users module: own account (/me), student badge, portfolio, public profiles.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UploadsModule } from '../uploads/uploads.module.js';
import { MeController } from './me.controller.js';
import { PortfolioController } from './portfolio.controller.js';
import { PortfolioService } from './portfolio.service.js';
import { ProfileService } from './profile.service.js';
import { StudentVerificationService } from './student-verification.service.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [MeController, PortfolioController, UsersController],
  providers: [ProfileService, StudentVerificationService, PortfolioService],
  exports: [ProfileService, StudentVerificationService],
})
export class UsersModule {}
