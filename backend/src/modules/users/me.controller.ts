/**
 * /api/v1/me — the signed-in user's own account.
 *
 * | Endpoint                                 | Body (shared schema)                | Success |
 * |------------------------------------------|-------------------------------------|---------|
 * | GET    /me                               | —                                   | 200 MeResponse |
 * | PATCH  /me                               | updateProfileSchema                 | 200 MeResponse |
 * | DELETE /me                               | deleteAccountSchema (password)      | 204 (account anonymised) |
 * | POST   /me/student-verification          | startStudentVerificationSchema      | 200 MeResponse (student.pendingEmail set) |
 * | POST   /me/student-verification/confirm  | confirmStudentVerificationSchema    | 200 MeResponse (student.verified = true) |
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import {
  confirmStudentVerificationSchema,
  deleteAccountSchema,
  startStudentVerificationSchema,
  updateProfileSchema,
  type ConfirmStudentVerificationInput,
  type DeleteAccountInput,
  type MeResponse,
  type StartStudentVerificationInput,
  type UpdateProfileInput,
} from '@cc/shared';
import { AuthRateLimit, CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { ProfileService } from './profile.service.js';
import { StudentVerificationService } from './student-verification.service.js';

@Controller('me')
export class MeController {
  constructor(
    private readonly profiles: ProfileService,
    private readonly students: StudentVerificationService,
  ) {}

  @Get()
  me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.profiles.getMe(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body({ schema: updateProfileSchema }) body: UpdateProfileInput): Promise<MeResponse> {
    return this.profiles.updateMe(user.id, body);
  }

  @AuthRateLimit()
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Body({ schema: deleteAccountSchema }) body: DeleteAccountInput): Promise<void> {
    await this.profiles.deleteAccount(user.id, body.password);
  }

  @AuthRateLimit()
  @Post('student-verification')
  @HttpCode(HttpStatus.OK)
  startStudent(
    @CurrentUser() user: AuthUser,
    @Body({ schema: startStudentVerificationSchema }) body: StartStudentVerificationInput,
  ): Promise<MeResponse> {
    return this.students.start(user.id, body.collegeEmail);
  }

  @AuthRateLimit()
  @Post('student-verification/confirm')
  @HttpCode(HttpStatus.OK)
  confirmStudent(
    @CurrentUser() user: AuthUser,
    @Body({ schema: confirmStudentVerificationSchema }) body: ConfirmStudentVerificationInput,
  ): Promise<MeResponse> {
    return this.students.confirm(user.id, body.code);
  }
}
