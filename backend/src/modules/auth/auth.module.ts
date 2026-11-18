/**
 * Auth module: accounts, sessions, email codes. Exports what other modules need:
 * the global AuthGuard (registered in app.module.ts), TokenService (realtime, Phase 4),
 * PasswordHasher (account deletion re-checks the password), CodeHasher (student badge codes).
 */
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { CodeHasher } from './code-hasher.js';
import { EmailCodeService } from './email-code.service.js';
import { PasswordHasher } from './password-hasher.js';
import { TokenService } from './token.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, PasswordHasher, CodeHasher, EmailCodeService, AuthGuard],
  exports: [AuthService, TokenService, AuthGuard, PasswordHasher, CodeHasher],
})
export class AuthModule {}
