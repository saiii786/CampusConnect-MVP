import { ApiError } from '@/lib/api/api-error';
import { applyServerErrors } from './server-errors';

describe('applyServerErrors', () => {
  it('puts VALIDATION_FAILED details on matching fields', () => {
    const setError = jest.fn();
    const error = new ApiError(400, 'VALIDATION_FAILED', 'bad', [
      { path: 'email', message: 'Enter a valid email address' },
      { path: 'unknownField', message: 'ignored' },
    ]);
    expect(applyServerErrors(error, setError, ['email', 'password'])).toBeNull();
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'Enter a valid email address' });
  });

  it('maps field-specific codes such as AUTH_EMAIL_TAKEN to their field', () => {
    const setError = jest.fn();
    const error = new ApiError(409, 'AUTH_EMAIL_TAKEN', 'An account with this email already exists');
    expect(applyServerErrors(error, setError, ['email'])).toBeNull();
    expect(setError).toHaveBeenCalledWith('email', expect.objectContaining({ message: error.message }));
  });

  it('returns a form-level message for everything else', () => {
    const setError = jest.fn();
    expect(applyServerErrors(new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect'), setError, ['email'])).toBe(
      'Email or password is incorrect',
    );
    expect(applyServerErrors(new ApiError(0, 'NETWORK_ERROR', 'x'), setError, ['email'])).toMatch(/reach the server/);
    expect(setError).not.toHaveBeenCalled();
  });
});
