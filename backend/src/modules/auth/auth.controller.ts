/**
 * /api/v1/auth/* — thin HTTP layer over AuthService. Every body is validated by a shared zod
 * schema from @cc/shared (the mobile app uses the same schemas for its forms).
 *
 * | Endpoint                       | Auth   | Rate limit | Success                      |
 * |--------------------------------|--------|------------|------------------------------|
 * | POST /auth/signup              | public | auth       | 201 AuthSessionResponse      |
 * | POST /auth/login               | public | auth       | 200 AuthSessionResponse      |
 * | POST /auth/refresh             | public | auth       | 200 AuthSessionResponse      |
 * | POST /auth/logout              | public | default    | 204                          |
 * | POST /auth/verify-email        | signed | auth       | 200 MeResponse               |
 * | POST /auth/resend-verification | signed | auth       | 202                          |
 * | POST /auth/forgot-password     | public | auth       | 202 (always, no enumeration) |
 * | POST /auth/reset-password      | public | auth       | 204                          |
 *
 * logout is public because the refresh token in the body IS the credential (the access token
 * may already be expired when the user signs out).
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
  type AuthSessionResponse,
  type ForgotPasswordInput,
  type LoginInput,
  type MeResponse,
  type RefreshTokenInput,
  type ResetPasswordInput,
  type SignupInput,
  type VerifyEmailInput,
} from '@cc/shared';
import { AuthRateLimit, CurrentUser, Public, type AuthUser } from './auth.decorators.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @AuthRateLimit()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signup(@Body({ schema: signupSchema }) body: SignupInput): Promise<AuthSessionResponse> {
    return this.auth.signup(body);
  }

  @Public()
  @AuthRateLimit()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body({ schema: loginSchema }) body: LoginInput): Promise<AuthSessionResponse> {
    return this.auth.login(body);
  }

  @Public()
  @AuthRateLimit()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body({ schema: refreshTokenSchema }) body: RefreshTokenInput): Promise<AuthSessionResponse> {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body({ schema: refreshTokenSchema }) body: RefreshTokenInput): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  @AuthRateLimit()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(
    @CurrentUser() user: AuthUser,
    @Body({ schema: verifyEmailSchema }) body: VerifyEmailInput,
  ): Promise<MeResponse> {
    return this.auth.verifyEmail(user.id, body.code);
  }

  @AuthRateLimit()
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(@CurrentUser() user: AuthUser): Promise<void> {
    await this.auth.resendVerification(user.id);
  }

  @Public()
  @AuthRateLimit()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body({ schema: forgotPasswordSchema }) body: ForgotPasswordInput): Promise<void> {
    await this.auth.forgotPassword(body.email);
  }

  @Public()
  @AuthRateLimit()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body({ schema: resetPasswordSchema }) body: ResetPasswordInput): Promise<void> {
    await this.auth.resetPassword(body);
  }
}
