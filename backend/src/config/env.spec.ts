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

  it('mail: brevo needs an API key and a sender address; sender name defaults to Connect', () => {
    const problems = problemsOf({ ...VALID, MAIL_DRIVER: 'brevo' });
    expect(problems).toContain('BREVO_API_KEY');
    expect(problems).toContain('MAIL_FROM_EMAIL');
    const env = loadEnv({ ...VALID, MAIL_DRIVER: 'brevo', BREVO_API_KEY: 'xkeysib-0123456789abcdefghij', MAIL_FROM_EMAIL: 'hello@example.com' });
    expect(env.MAIL_DRIVER).toBe('brevo');
    expect(env.MAIL_FROM_NAME).toBe('Connect');
    expect(problemsOf({ ...VALID, MAIL_DRIVER: 'brevo', BREVO_API_KEY: 'xkeysib-0123456789abcdefghij', MAIL_FROM_EMAIL: 'not-an-email' })).toContain('MAIL_FROM_EMAIL');
  });

  it('storage: local by default; supabase needs its settings; production refuses local', () => {
    expect(loadEnv(VALID).STORAGE_DRIVER).toBe('local');
    const problems = problemsOf({ ...VALID, STORAGE_DRIVER: 'supabase' });
    for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STORAGE_BUCKET']) expect(problems).toContain(name);
    expect(
      loadEnv({
        ...VALID,
        STORAGE_DRIVER: 'supabase',
        SUPABASE_URL: 'https://abcd.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'x'.repeat(40),
        STORAGE_BUCKET: 'media',
      }).STORAGE_BUCKET,
    ).toBe('media');
    expect(problemsOf({ ...VALID, NODE_ENV: 'production' })).toContain('STORAGE_DRIVER');
  });

  it('payments: fake by default; razorpay needs keys and refuses LIVE keys; production refuses fake', () => {
    expect(loadEnv(VALID).PAYMENT_GATEWAY).toBe('fake');
    const missing = problemsOf({ ...VALID, PAYMENT_GATEWAY: 'razorpay' });
    for (const name of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']) expect(missing).toContain(name);
    const rzp = { ...VALID, PAYMENT_GATEWAY: 'razorpay', RAZORPAY_KEY_SECRET: 'secret123', RAZORPAY_WEBHOOK_SECRET: 'whsecret123' };
    expect(loadEnv({ ...rzp, RAZORPAY_KEY_ID: 'rzp_test_abc' }).RAZORPAY_KEY_ID).toBe('rzp_test_abc');
    expect(problemsOf({ ...rzp, RAZORPAY_KEY_ID: 'rzp_live_abc' })).toContain('RAZORPAY_KEY_ID');
    expect(problemsOf({ ...VALID, NODE_ENV: 'production' })).toContain('PAYMENT_GATEWAY');
  });

  it('never includes variable values in the error (they may be secrets)', () => {
    const secret = 'postgresql-but-not-really-SECRET123';
    expect(problemsOf({ ...VALID, DATABASE_URL: secret })).not.toContain('SECRET123');
    expect(problemsOf({ ...VALID, JWT_ACCESS_SECRET: 'SECRET123' })).not.toContain('SECRET123');
  });
});
