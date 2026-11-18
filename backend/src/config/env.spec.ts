import { InvalidEnvironmentError, loadEnv } from './env.js';

const VALID = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  DIRECT_URL: 'postgresql://u:p@localhost:5432/db',
};

describe('loadEnv', () => {
  it('accepts a minimal valid environment and applies defaults', () => {
    const env = loadEnv(VALID);
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('log');
    expect(env.LOG_JSON).toBe(false);
    expect(env.CORS_ORIGINS).toEqual([]);
    expect(env.RATE_LIMIT_PER_MINUTE).toBe(120);
  });

  it('parses comma-separated CORS origins and booleans', () => {
    const env = loadEnv({ ...VALID, CORS_ORIGINS: 'https://a.example, https://b.example ,', LOG_JSON: 'true' });
    expect(env.CORS_ORIGINS).toEqual(['https://a.example', 'https://b.example']);
    expect(env.LOG_JSON).toBe(true);
  });

  it('refuses to start when required variables are missing, naming each one', () => {
    try {
      loadEnv({});
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidEnvironmentError);
      const problems = (error as InvalidEnvironmentError).problems.join('\n');
      expect(problems).toContain('NODE_ENV');
      expect(problems).toContain('DATABASE_URL');
      expect(problems).toContain('DIRECT_URL');
    }
  });

  it('rejects non-postgres database URLs and bad numbers', () => {
    expect(() => loadEnv({ ...VALID, DATABASE_URL: 'mysql://x@y/z' })).toThrow(InvalidEnvironmentError);
    expect(() => loadEnv({ ...VALID, PORT: 'abc' })).toThrow(InvalidEnvironmentError);
  });

  it('never includes variable values in the error (they may be secrets)', () => {
    const secret = 'postgresql-but-not-really-SECRET123';
    try {
      loadEnv({ ...VALID, DATABASE_URL: secret });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain('SECRET123');
    }
  });
});
