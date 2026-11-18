/**
 * Image upload workflow (FR-051), the same for every storage driver:
 *
 *   1. sign(user, { purpose, contentType, sizeBytes })  → UploadTarget { key, uploadUrl, headers }
 *      The SERVER chooses the key: users/<userId>/<purpose>/<random uuid>.<ext>
 *   2. The app sends the file to uploadUrl.
 *   3. A feature (profile photo, portfolio…) calls claim(user, key, purpose): the key must be in the
 *      caller's own folder for that purpose, and the object must exist, be ≤ 5 MB and be an image.
 *      Only then is its public URL stored.
 *
 * Replaced or deleted images are removed with discard() (best effort; a failure is only logged).
 * Signed-but-never-claimed uploads are left behind for now (cleanup job: parking lot).
 */
import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  IMAGE_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  type SignUploadInput,
  type UploadPurpose,
  type UploadTarget,
} from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { StorageService } from '../storage/storage.service.js';

export interface ClaimedUpload {
  key: string;
  url: string;
}

const IMAGE_TYPES = new Set<string>(Object.keys(IMAGE_CONTENT_TYPES));

export function uploadFolder(userId: string, purpose: UploadPurpose): string {
  return `users/${userId}/${purpose.toLowerCase()}/`;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger('Uploads');

  constructor(private readonly storage: StorageService) {}

  sign(userId: string, input: SignUploadInput): Promise<UploadTarget> {
    const ext = IMAGE_CONTENT_TYPES[input.contentType];
    const key = `${uploadFolder(userId, input.purpose)}${randomUUID()}.${ext}`;
    return this.storage.createUploadTarget(key, input.contentType, MAX_UPLOAD_BYTES);
  }

  async claim(userId: string, key: string, purpose: UploadPurpose): Promise<ClaimedUpload> {
    if (!key.startsWith(uploadFolder(userId, purpose))) {
      throw AppError.badRequest('UPLOAD_INVALID', 'This image upload cannot be used here');
    }
    const info = await this.storage.stat(key);
    if (!info) throw AppError.badRequest('UPLOAD_NOT_FOUND', 'The image was not uploaded. Please try again.');
    const typeOk = info.contentType === null || IMAGE_TYPES.has(info.contentType.split(';')[0]!.trim());
    if (info.sizeBytes <= 0 || info.sizeBytes > MAX_UPLOAD_BYTES || !typeOk) {
      await this.discard([key]);
      throw AppError.badRequest('UPLOAD_INVALID', 'The uploaded file is not a valid image up to 5 MB');
    }
    return { key, url: this.storage.publicUrl(key) };
  }

  /** Delete images that are no longer used. Never throws. */
  async discard(keys: (string | null | undefined)[]): Promise<void> {
    const list = keys.filter((k): k is string => typeof k === 'string' && k.length > 0);
    if (list.length === 0) return;
    try {
      await this.storage.delete(list);
    } catch (error) {
      this.logger.warn(`Could not delete ${list.length} stored image(s): ${(error as Error).message}`);
    }
  }
}
