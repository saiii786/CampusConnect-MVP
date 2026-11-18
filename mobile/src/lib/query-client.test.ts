import { ApiError } from './api/api-error';
import { shouldRetry } from './query-client';

describe('shouldRetry', () => {
  it('retries connection problems and server errors, at most twice', () => {
    expect(shouldRetry(0, new ApiError(0, 'NETWORK_ERROR', ''))).toBe(true);
    expect(shouldRetry(1, new ApiError(503, 'SERVICE_UNAVAILABLE', ''))).toBe(true);
    expect(shouldRetry(2, new ApiError(0, 'NETWORK_ERROR', ''))).toBe(false);
  });

  it('never retries client errors (they will not fix themselves)', () => {
    expect(shouldRetry(0, new ApiError(400, 'VALIDATION_FAILED', ''))).toBe(false);
    expect(shouldRetry(0, new ApiError(404, 'NOT_FOUND', ''))).toBe(false);
  });
});
