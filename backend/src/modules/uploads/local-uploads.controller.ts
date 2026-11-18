/**
 * Local storage driver endpoints (STORAGE_DRIVER=local — development and tests only).
 * With the Supabase driver these routes answer 404; the app uploads to Supabase instead.
 *
 *   PUT /api/v1/uploads/local/:token   raw image body; the signed token says which key, type and
 *                                      size are allowed (public route — the token is the credential)
 *   GET /api/v1/uploads/files/<key>    serve a stored image (public, like Supabase public URLs)
 */
import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Put, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { uploadKeySchema } from '@cc/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';
import { Public } from '../auth/auth.decorators.js';
import { contentTypeOfKey, LocalStorageService } from '../storage/local-storage.service.js';
import { detectImageType } from './image-signature.js';

const tokenSchema = z
  .string()
  .max(2000)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'Invalid upload link');

/** Express 5 delivers a `*key` wildcard as an array of path segments. */
const fileKeySchema = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v.join('/') : v))
  .pipe(uploadKeySchema);

@Public()
@Controller('uploads')
export class LocalUploadsController {
  constructor(
    private readonly local: LocalStorageService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  @Put('local/:token')
  @HttpCode(HttpStatus.OK)
  async upload(
    @Param('token', { schema: tokenSchema }) token: string,
    @Req() req: Request,
  ): Promise<{ key: string }> {
    this.assertEnabled();
    const grant = this.local.verifyToken(token);
    const body: unknown = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new AppError('UPLOAD_CONTENT_TYPE', 'Send the image bytes with an image Content-Type', 415);
    }
    const sentType = (req.headers['content-type'] ?? '').split(';')[0]!.trim();
    if (sentType !== grant.contentType || detectImageType(body) !== grant.contentType) {
      throw new AppError('UPLOAD_CONTENT_TYPE', 'The file does not match the declared image type', 415);
    }
    if (body.length > grant.maxBytes) {
      throw new AppError('PAYLOAD_TOO_LARGE', 'The image is too large', 413);
    }
    await this.local.write(grant.key, body);
    return { key: grant.key };
  }

  @SkipThrottle()
  @Get('files/*key')
  async file(@Param('key', { schema: fileKeySchema }) key: string, @Res() res: Response): Promise<void> {
    this.assertEnabled();
    const path = this.local.pathOf(key);
    if (!(await this.local.stat(key))) throw AppError.notFound();
    res.setHeader('Content-Type', contentTypeOfKey(key) ?? 'application/octet-stream');
    // Keys are random and never reused, so files can be cached forever.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // `dotfiles: 'allow'`: the default storage folder is `.uploads`, and Express refuses to serve
    // anything under a dot-folder otherwise. Safe: `path` was validated by pathOf() above.
    res.sendFile(path, { dotfiles: 'allow' });
  }

  private assertEnabled(): void {
    if (this.env.STORAGE_DRIVER !== 'local') throw AppError.notFound();
  }
}
