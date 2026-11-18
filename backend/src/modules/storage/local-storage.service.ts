/**
 * Local-disk storage for development and tests (STORAGE_DRIVER=local; refused in production).
 *
 * Mirrors the production flow so the app code is identical:
 *   1. createUploadTarget → `PUT /api/v1/uploads/local/<token>`; the token is HMAC-signed and
 *      carries the key, content type, max size and expiry (nobody can upload anywhere else).
 *   2. LocalUploadsController verifies the token and calls `write()`.
 *   3. Files are served by `GET /api/v1/uploads/files/<key>`.
 * Keys are validated against UPLOAD_KEY_PATTERN and resolved inside STORAGE_LOCAL_DIR only.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { UPLOAD_KEY_PATTERN, type UploadTarget } from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';
import { StorageService, type StoredObjectInfo } from './storage.service.js';

export const LOCAL_UPLOAD_TTL_MS = 10 * 60 * 1000;
const API_BASE_PATH = '/api/v1';

const CONTENT_TYPE_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

interface LocalUploadClaims {
  k: string; // key
  t: string; // content type
  m: number; // max bytes
  e: number; // expiry (ms since epoch)
}

@Injectable()
export class LocalStorageService extends StorageService {
  readonly root: string;

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {
    super();
    this.root = resolve(env.STORAGE_LOCAL_DIR);
  }

  async createUploadTarget(key: string, contentType: string, maxBytes: number): Promise<UploadTarget> {
    const expiresAt = Date.now() + LOCAL_UPLOAD_TTL_MS;
    const token = this.signToken({ k: key, t: contentType, m: maxBytes, e: expiresAt });
    return {
      key,
      uploadUrl: `${API_BASE_PATH}/uploads/local/${token}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  /** Validate an upload token; returns what may be uploaded with it. */
  verifyToken(token: string, now = Date.now()): { key: string; contentType: string; maxBytes: number } {
    const [payload, signature] = token.split('.');
    if (!payload || !signature || !safeEqual(signature, this.sign(payload))) throw uploadTokenInvalid();
    let claims: LocalUploadClaims;
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as LocalUploadClaims;
    } catch {
      throw uploadTokenInvalid();
    }
    if (typeof claims.e !== 'number' || claims.e < now) {
      throw AppError.badRequest('UPLOAD_TOKEN_EXPIRED', 'This upload link has expired. Please try again.');
    }
    if (!UPLOAD_KEY_PATTERN.test(claims.k)) throw uploadTokenInvalid();
    return { key: claims.k, contentType: claims.t, maxBytes: claims.m };
  }

  async write(key: string, data: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async stat(key: string): Promise<StoredObjectInfo | null> {
    try {
      const info = await stat(this.pathOf(key));
      return { sizeBytes: info.size, contentType: contentTypeOfKey(key) };
    } catch {
      return null;
    }
  }

  publicUrl(key: string): string {
    return `${API_BASE_PATH}/uploads/files/${key}`;
  }

  async delete(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        try {
          await unlink(this.pathOf(key));
        } catch {
          // already gone
        }
      }),
    );
  }

  /** Absolute path of a key, guaranteed to be inside the storage folder. */
  pathOf(key: string): string {
    if (!UPLOAD_KEY_PATTERN.test(key)) throw AppError.notFound();
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw AppError.notFound();
    return path;
  }

  private signToken(claims: LocalUploadClaims): string {
    const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  private sign(payload: string): string {
    // Domain-separated from email-code hashes that use the same secret.
    return createHmac('sha256', this.env.CODE_HASH_SECRET).update(`local-upload:${payload}`).digest('base64url');
  }
}

export function contentTypeOfKey(key: string): string | null {
  return CONTENT_TYPE_BY_EXT[key.slice(key.lastIndexOf('.') + 1)] ?? null;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function uploadTokenInvalid(): AppError {
  return AppError.badRequest('UPLOAD_TOKEN_INVALID', 'This upload link is not valid');
}
