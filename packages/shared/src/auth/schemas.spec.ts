import { describe, expect, it } from 'vitest';
import {
  ageInYears,
  emailSchema,
  loginSchema,
  parseIsoDate,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from './schemas.js';

const validSignup = {
  email: '  Priya.S@Example.COM ',
  password: 'correct horse',
  displayName: '  Priya S ',
  dateOfBirth: '2000-01-15',
  acceptTerms: true,
};

describe('emailSchema', () => {
  it('trims and lower-cases', () => {
    expect(emailSchema.parse('  A.B@Example.Com ')).toBe('a.b@example.com');
  });
  it.each(['', 'not-an-email', 'a@', '@b.com', 'a b@c.com'])('rejects %j', (v) => {
    expect(emailSchema.safeParse(v).success).toBe(false);
  });
});

describe('parseIsoDate / ageInYears', () => {
  it('rejects impossible and malformed dates', () => {
    expect(parseIsoDate('2001-02-30')).toBeNull();
    expect(parseIsoDate('2001-13-01')).toBeNull();
    expect(parseIsoDate('15-01-2000')).toBeNull();
    expect(parseIsoDate('2000-01-15')).toEqual({ year: 2000, month: 1, day: 15 });
  });
  it('counts whole years, turning 18 exactly on the birthday', () => {
    const today = new Date(Date.UTC(2026, 10, 18)); // 2026-11-18
    expect(ageInYears('2008-11-18', today)).toBe(18);
    expect(ageInYears('2008-11-19', today)).toBe(17);
    expect(ageInYears('2008-12-01', today)).toBe(17);
    expect(ageInYears('2000-02-29', new Date(Date.UTC(2018, 1, 28)))).toBe(17);
  });
});

describe('signupSchema', () => {
  it('accepts a valid signup and normalises fields', () => {
    const out = signupSchema.parse(validSignup);
    expect(out.email).toBe('priya.s@example.com');
    expect(out.displayName).toBe('Priya S');
  });

  it('rejects under-18 users', () => {
    const now = new Date();
    const seventeen = `${now.getUTCFullYear() - 17}-01-01`;
    const r = signupSchema.safeParse({ ...validSignup, dateOfBirth: seventeen });
    expect(r.success).toBe(false);
  });

  it('requires acceptTerms to be exactly true', () => {
    expect(signupSchema.safeParse({ ...validSignup, acceptTerms: false }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, acceptTerms: 'true' }).success).toBe(false);
  });

  it('rejects short, too-long and blank passwords', () => {
    expect(signupSchema.safeParse({ ...validSignup, password: 'short' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, password: 'x'.repeat(129) }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, password: '         ' }).success).toBe(false);
  });

  it('rejects unknown fields (no mass assignment, e.g. role)', () => {
    expect(signupSchema.safeParse({ ...validSignup, role: 'ADMIN' }).success).toBe(false);
  });
});

describe('other auth schemas', () => {
  it('login does not enforce the signup password rules', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
  it('codes are exactly 6 digits', () => {
    expect(verifyEmailSchema.safeParse({ code: '123456' }).success).toBe(true);
    expect(verifyEmailSchema.safeParse({ code: ' 123456 ' }).success).toBe(true);
    expect(verifyEmailSchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(verifyEmailSchema.safeParse({ code: '12345a' }).success).toBe(false);
  });
  it('reset requires a valid new password', () => {
    expect(
      resetPasswordSchema.safeParse({ email: 'a@b.co', code: '123456', newPassword: 'short' }).success,
    ).toBe(false);
  });
});
