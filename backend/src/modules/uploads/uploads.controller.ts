/**
 * POST /api/v1/uploads/sign — get an upload target for one image (signed in users only).
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { signUploadSchema, type SignUploadInput, type UploadTarget } from '@cc/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { UploadsService } from './uploads.service.js';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('sign')
  @HttpCode(HttpStatus.OK)
  sign(@CurrentUser() user: AuthUser, @Body({ schema: signUploadSchema }) body: SignUploadInput): Promise<UploadTarget> {
    return this.uploads.sign(user.id, body);
  }
}
