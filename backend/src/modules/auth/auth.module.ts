/**
 * Auth module: accounts, sessions, email codes. Exports TokenService + AuthService so the
 * global AuthGuard (registered in app.module.ts) and other modules (users, realtime) can use them.
 */
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { EmailCodeService } from './email-code.service.js';
import { PasswordHasher } from './password-hasher.js';
import { TokenService } from './token.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, PasswordHasher, EmailCodeService, AuthGuard],
  exports: [AuthService, TokenService, AuthGuard],
})
export class AuthModule {}
