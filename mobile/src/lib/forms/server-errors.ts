/**
 * Puts server-side errors onto form fields so users see them next to the right input.
 *
 *   catch (e) { setFormError(applyServerErrors(e, setError, ['email', 'password'])); }
 *
 * - VALIDATION_FAILED with details [{ path: 'email', message }] → field errors
 * - known field-specific codes (e.g. AUTH_EMAIL_TAKEN → email)  → field error
 * - anything else → returned as a form-level message (show it in a <Notice>)
 */
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, describeError } from '@/lib/api/api-error';

/** Error codes that belong to one specific field. */
const FIELD_FOR_CODE: Record<string, string> = {
  AUTH_EMAIL_TAKEN: 'email',
  AUTH_CODE_INVALID: 'code',
  AUTH_CODE_EXPIRED: 'code',
};

export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_FAILED' && Array.isArray(error.details)) {
      let placed = false;
      for (const issue of error.details as { path?: unknown; message?: unknown }[]) {
        const path = typeof issue.path === 'string' ? issue.path : '';
        if ((fields as readonly string[]).includes(path) && typeof issue.message === 'string') {
          setError(path as Path<T>, { type: 'server', message: issue.message });
          placed = true;
        }
      }
      if (placed) return null;
    }
    const field = FIELD_FOR_CODE[error.code];
    if (field && (fields as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: 'server', message: error.message });
      return null;
    }
  }
  return describeError(error);
}
