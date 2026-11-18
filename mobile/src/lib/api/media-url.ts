/**
 * Image URLs from the API are either absolute (Supabase Storage) or a path starting with "/"
 * (local dev storage served by the API, e.g. "/api/v1/uploads/files/…"). Paths are resolved
 * against the API's origin so they work on the phone.
 */
import { getApiBaseUrl } from '@/config/api-url';

/** Pure version for tests. */
export function resolveMediaUrlWith(url: string, apiBaseUrl: string): string {
  if (!url.startsWith('/')) return url;
  const origin = /^(https?:\/\/[^/]+)/i.exec(apiBaseUrl)?.[1] ?? '';
  return `${origin}${url}`;
}

export function resolveMediaUrl(url: string): string;
export function resolveMediaUrl(url: string | null | undefined): string | null;
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return resolveMediaUrlWith(url, getApiBaseUrl());
}
