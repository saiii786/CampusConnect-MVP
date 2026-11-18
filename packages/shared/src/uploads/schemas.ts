/**
 * Image uploads (FR-051, later FR-150). The app asks the API for an upload target, sends the
 * file straight to storage, then refers to the upload by its `key` (never by a URL it made up).
 */
import { z } from 'zod';

export const UploadPurpose = { AVATAR: 'AVATAR', PORTFOLIO: 'PORTFOLIO' } as const;
export type UploadPurpose = (typeof UploadPurpose)[keyof typeof UploadPurpose];

/** Accepted image types → file extension used in the storage key. */
export const IMAGE_CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;
export type ImageContentType = keyof typeof IMAGE_CONTENT_TYPES;

/** 5 MB. The app resizes photos before upload, so real files are usually far smaller. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** POST /uploads/sign */
export const signUploadSchema = z
  .object({
    purpose: z.enum(UploadPurpose),
    contentType: z.enum(Object.keys(IMAGE_CONTENT_TYPES) as [ImageContentType, ...ImageContentType[]], {
      error: 'Only JPEG, PNG or WebP images are allowed',
    }),
    sizeBytes: z
      .number()
      .int()
      .min(1)
      .max(MAX_UPLOAD_BYTES, `Images must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller`),
  })
  .strict();
export type SignUploadInput = z.infer<typeof signUploadSchema>;

/**
 * Storage keys look like `users/<userId>/<purpose>/<uuid>.<ext>`. The server re-checks that a
 * key belongs to the caller and to the right purpose before using it.
 */
export const UPLOAD_KEY_PATTERN =
  /^users\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(avatar|portfolio)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export const uploadKeySchema = z.string().regex(UPLOAD_KEY_PATTERN, 'Invalid upload reference');

/** Response of POST /uploads/sign: where and how to send the file. */
export interface UploadTarget {
  key: string;
  /** Absolute URL, or a path starting with "/" that is relative to the API origin (local dev storage). */
  uploadUrl: string;
  method: 'PUT';
  /** Headers the upload request must send (at least Content-Type). */
  headers: Record<string, string>;
  expiresAt: string;
}
