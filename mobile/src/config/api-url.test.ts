import { ApiUrlNotConfiguredError, resolveApiBaseUrl } from './api-url';

describe('resolveApiBaseUrl', () => {
  it('prefers the explicit EXPO_PUBLIC_API_URL and trims trailing slashes', () => {
    expect(resolveApiBaseUrl('https://api.example.com/api/v1/', '192.168.1.5:8081', true)).toBe(
      'https://api.example.com/api/v1',
    );
  });

  it('in development falls back to the dev-server computer on port 3000', () => {
    expect(resolveApiBaseUrl(undefined, '192.168.1.5:8081', true)).toBe('http://192.168.1.5:3000/api/v1');
    expect(resolveApiBaseUrl('  ', '10.0.2.2:8081', true)).toBe('http://10.0.2.2:3000/api/v1');
  });

  it('never guesses in production builds', () => {
    expect(() => resolveApiBaseUrl(undefined, '192.168.1.5:8081', false)).toThrow(ApiUrlNotConfiguredError);
  });

  it('fails clearly when nothing is configured', () => {
    expect(() => resolveApiBaseUrl(undefined, null, true)).toThrow(/EXPO_PUBLIC_API_URL/);
  });
});
