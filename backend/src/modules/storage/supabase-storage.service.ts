/**
 * Supabase Storage driver (STORAGE_DRIVER=supabase). Uses the Storage REST API directly
 * (same calls as the official storage-js client, checked against its source on 2026-11-18):
 *
 *   sign upload : POST {SUPABASE_URL}/storage/v1/object/upload/sign/{bucket}/{key}  → { url: "/object/upload/sign/…?token=…" }
 *   app uploads : PUT  {SUPABASE_URL}/storage/v1/object/upload/sign/{bucket}/{key}?token=…  (file body)
 *   public URL  :      {SUPABASE_URL}/storage/v1/object/public/{bucket}/{key}
 *   stat        : HEAD public URL (bucket is public)
 *   delete      : DELETE {SUPABASE_URL}/storage/v1/object/{bucket}  body { prefixes: [keys] }
 *
 * The service-role key never leaves the server. The bucket must be PUBLIC (read) with a 5 MB
 * file-size limit and image MIME types only — setup steps in backend/src/modules/storage/README.md.
 *
 * ⚠ Not yet verified against a live Supabase project (needs the founder's project) — see DEV_LOG.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { UploadTarget } from '@cc/shared';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';
import { StorageService, type StoredObjectInfo } from './storage.service.js';

/** Supabase signed upload URLs are valid for 2 hours. */
const SIGNED_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;

export const SUPABASE_FETCH = Symbol('SUPABASE_FETCH');

@Injectable()
export class SupabaseStorageService extends StorageService {
  private readonly logger = new Logger('Storage');
  private readonly base: string;
  private readonly bucket: string;
  private readonly serviceKey: string;

  constructor(
    @Inject(APP_ENV) env: AppEnv,
    @Inject(SUPABASE_FETCH) private readonly fetchImpl: typeof fetch = fetch,
  ) {
    super();
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.STORAGE_BUCKET) {
      throw new Error('Supabase storage is not configured'); // env.ts already prevents this
    }
    this.base = `${env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1`;
    this.bucket = env.STORAGE_BUCKET;
    this.serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  }

  private get authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey };
  }

  async createUploadTarget(key: string, contentType: string): Promise<UploadTarget> {
    const res = await this.fetchImpl(`${this.base}/object/upload/sign/${this.bucket}/${key}`, {
      method: 'POST',
      headers: { ...this.authHeaders, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) {
      this.logger.error(`Supabase sign upload failed: HTTP ${res.status}`);
      throw new Error(`Storage sign failed (${res.status})`);
    }
    const data = (await res.json()) as { url?: unknown };
    if (typeof data.url !== 'string' || !data.url.includes('token=')) {
      throw new Error('Storage sign returned an unexpected response');
    }
    return {
      key,
      uploadUrl: `${this.base}${data.url}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
      expiresAt: new Date(Date.now() + SIGNED_UPLOAD_TTL_MS).toISOString(),
    };
  }

  async stat(key: string): Promise<StoredObjectInfo | null> {
    const res = await this.fetchImpl(this.publicUrl(key), { method: 'HEAD' });
    if (!res.ok) return null;
    return {
      sizeBytes: Number(res.headers.get('content-length') ?? '0'),
      contentType: res.headers.get('content-type'),
    };
  }

  publicUrl(key: string): string {
    return `${this.base}/object/public/${this.bucket}/${key}`;
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const res = await this.fetchImpl(`${this.base}/object/${this.bucket}`, {
      method: 'DELETE',
      headers: { ...this.authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: keys }),
    });
    if (!res.ok) this.logger.warn(`Supabase delete failed: HTTP ${res.status} (${keys.length} objects)`);
  }
}
