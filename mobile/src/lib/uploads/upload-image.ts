/**
 * Pick → shrink → upload an image (FR-051). Used for the profile photo and portfolio items.
 *
 *   const picked = await pickImage({ square: true });        // null if the user cancelled
 *   if (picked) { const key = await uploadImage(picked.uri, 'AVATAR'); … PATCH /me { avatarUploadKey: key } }
 *
 * - Photos are resized to at most 1280 px wide and saved as JPEG (quality 0.8) before upload, so a
 *   12 MP phone photo (~4 MB) becomes ~200–400 KB: faster on mobile data, kinder to free storage.
 * - Upload flow: POST /uploads/sign → PUT the bytes to the returned URL (Supabase in production,
 *   the API itself in local dev). The server then only accepts the returned `key` from this user.
 */
import { MAX_UPLOAD_BYTES, type UploadPurpose, type UploadTarget } from '@cc/shared';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ApiError } from '@/lib/api/api-error';
import { api } from '@/lib/api/client';
import { resolveMediaUrl } from '@/lib/api/media-url';

export const MAX_IMAGE_WIDTH = 1280;
export const JPEG_QUALITY = 0.8;

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

/** Open the photo library; returns a resized JPEG, or null if cancelled. */
export async function pickImage(options: { square?: boolean } = {}): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: options.square ? [1, 1] : [4, 3],
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_IMAGE_WIDTH) context.resize({ width: MAX_IMAGE_WIDTH });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Upload a local JPEG file; returns the storage key to send to the API. */
export async function uploadImage(
  localUri: string,
  purpose: UploadPurpose,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<string> {
  const blob = await (await fetchImpl(localUri)).blob();
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'This image is too large. Please choose a smaller one.');
  }
  const target = await api.post<UploadTarget>('/uploads/sign', {
    purpose,
    contentType: 'image/jpeg',
    sizeBytes: blob.size,
  });

  let response: Response;
  try {
    response = await fetchImpl(resolveMediaUrl(target.uploadUrl), {
      method: target.method,
      headers: target.headers,
      body: blob,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
  }
  if (!response.ok) {
    throw new ApiError(response.status, 'UPLOAD_FAILED', 'The image could not be uploaded. Please try again.');
  }
  return target.key;
}
