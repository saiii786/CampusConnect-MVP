import { InvalidEnvironmentError, loadEnv } from './env.js';

const VALID = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  DIRECT_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  CODE_HASH_SECRET: 'b'.repeat(32),
};

function problemsOf(source: Record<string, string>): string {
  try {
    loadEnv(source);
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidEnvironmentError);
    return (error as InvalidEnvironmentError).problems.join('\n');
  }
  return expect.unreachable('should have thrown');
}

describe('loadEnv', () => {
  it('accepts a minimal valid environment and applies defaults', () => {
    const env = loadEnv(VALID);
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('log');
    expect(env.LOG_JSON).toBe(false);
    expect(env.CORS_ORIGINS).toEqual([]);
    expect(env.RATE_LIMIT_PER_MINUTE).toBe(120);
    expect(env.ACCESS_TOKEN_TTL_MINUTES).toBe(15);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(env.AUTH_RATE_LIMIT_PER_MINUTE).toBe(10);
    expect(env.MAIL_DRIVER).toBe('console');
  });

  it('parses comma-separated CORS origins and booleans', () => {
    const env = loadEnv({ ...VALID, CORS_ORIGINS: 'https://a.example, https://b.example ,', LOG_JSON: 'true' });
    expect(env.CORS_ORIGINS).toEqual(['https://a.example', 'https://b.example']);
    expect(env.LOG_JSON).toBe(true);
  });

  it('refuses to start when required variables are missing, naming each one', () => {
    const problems = problemsOf({});
    for (const name of ['NODE_ENV', 'DATABASE_URL', 'DIRECT_URL', 'JWT_ACCESS_SECRET', 'CODE_HASH_SECRET']) {
      expect(problems).toContain(name);
    }
  });

  it('rejects non-postgres database URLs and bad numbers', () => {
    expect(() => loadEnv({ ...VALID, DATABASE_URL: 'mysql://x@y/z' })).toThrow(InvalidEnvironmentError);
    expect(() => loadEnv({ ...VALID, PORT: 'abc' })).toThrow(InvalidEnvironmentError);
  });

  it('rejects short or identical auth secrets', () => {
    expect(problemsOf({ ...VALID, JWT_ACCESS_SECRET: 'too-short' })).toContain('JWT_ACCESS_SECRET');
    expect(problemsOf({ ...VALID, CODE_HASH_SECRET: VALID.JWT_ACCESS_SECRET })).toContain('CODE_HASH_SECRET');
  });

  it('in production, refuses placeholder secrets and console mail', () => {
    const problems = problemsOf({
      ...VALID,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'dev-only-change-me-access-secret-0123456789',
    });
    expect(problems).toContain('JWT_ACCESS_SECRET');
    expect(problems).toContain('MAIL_DRIVER');
  });

  it('never includes variable values in the error (they may be secrets)', () => {
    const secret = 'postgresql-but-not-really-SECRET123';
    expect(problemsOf({ ...VALID, DATABASE_URL: secret })).not.toContain('SECRET123');
    expect(problemsOf({ ...VALID, JWT_ACCESS_SECRET: 'SECRET123' })).not.toContain('SECRET123');
  });
});
