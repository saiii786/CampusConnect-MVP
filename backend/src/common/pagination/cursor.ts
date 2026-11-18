/**
 * Opaque pagination cursors (ARCHITECTURE §8: `?cursor=…` → `{ items, nextCursor }`).
 *
 * Two kinds, both base64url-encoded so clients never build or parse them:
 *   - keyset `{ k: 'id', v: <last id> }` — for "newest first" lists. Our ids are UUIDv7 (time-ordered),
 *     so `id < last` continues the list exactly, even while new rows are being added.
 *   - offset `{ k: 'off', v: <number> }` — for sorts that are not by id (distance, price).
 */
import { AppError } from '../errors/app-error.js';

export type Cursor = { k: 'id'; v: string } | { k: 'off'; v: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined, expected: Cursor['k']): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;
    if (parsed.k !== expected) throw new Error('wrong kind');
    if (parsed.k === 'id' && (typeof parsed.v !== 'string' || !UUID.test(parsed.v))) throw new Error('bad id');
    if (parsed.k === 'off' && (!Number.isSafeInteger(parsed.v) || parsed.v < 0 || parsed.v > 10_000)) {
      throw new Error('bad offset');
    }
    return parsed;
  } catch {
    throw AppError.badRequest('INVALID_CURSOR', 'This list position is no longer valid. Please reload.');
  }
}
