/**
 * Where uploaded images live (ADR-019). Feature code depends only on this abstract class; the
 * driver is chosen by STORAGE_DRIVER in storage.module.ts:
 *   - LocalStorageService     development/tests: files on disk, uploaded to and served by this API
 *   - SupabaseStorageService  production: the app uploads straight to Supabase Storage (free 1 GB)
 */
import type { UploadTarget } from '@cc/shared';

export interface StoredObjectInfo {
  sizeBytes: number;
  contentType: string | null;
}

export abstract class StorageService {
  /** Where/how the app should send the file for `key`. Valid for a limited time. */
  abstract createUploadTarget(key: string, contentType: string, maxBytes: number): Promise<UploadTarget>;
  /** Size/type of an uploaded object, or null if nothing was uploaded under `key`. */
  abstract stat(key: string): Promise<StoredObjectInfo | null>;
  /** URL the app uses to display the object (absolute, or "/…" relative to the API origin). */
  abstract publicUrl(key: string): string;
  /** Delete objects; missing ones are ignored. */
  abstract delete(keys: string[]): Promise<void>;
}
