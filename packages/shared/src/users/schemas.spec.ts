import { describe, expect, it } from 'vitest';
import { domainSchema, upsertStudentDomainSchema } from '../admin/schemas.js';
import { signUploadSchema, uploadKeySchema } from '../uploads/schemas.js';
import {
  createPortfolioItemSchema,
  emailDomain,
  idParamSchema,
  updatePortfolioItemSchema,
  updateProfileSchema,
} from './schemas.js';

const UID = '01936b6e-7c3a-7d4e-8f00-0123456789ab';
const KEY = `users/${UID}/avatar/01936b6e-7c3a-7d4e-8f00-0123456789ac.jpg`;

describe('updateProfileSchema', () => {
  it('cleans tags: trims, drops blanks and case-insensitive duplicates', () => {
    const out = updateProfileSchema.parse({ skills: [' Painting ', 'painting', '', 'Tutoring'] });
    expect(out.skills).toEqual(['Painting', 'Tutoring']);
  });

  it('turns empty strings into null (clearing a field)', () => {
    expect(updateProfileSchema.parse({ bio: '  ', city: '' })).toEqual({ bio: null, city: null });
  });

  it('limits sizes and rejects unknown fields or an empty update', () => {
    expect(updateProfileSchema.safeParse({ skills: Array.from({ length: 16 }, (_, i) => `s${i}`) }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ bio: 'x'.repeat(501) }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ email: 'a@b.co' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });

  it('accepts an upload key or null for the avatar, never a URL', () => {
    expect(updateProfileSchema.safeParse({ avatarUploadKey: KEY }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ avatarUploadKey: null }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ avatarUploadKey: 'https://evil.example/x.jpg' }).success).toBe(false);
  });
});

describe('uploads', () => {
  it('only signs images up to 5 MB', () => {
    expect(signUploadSchema.safeParse({ purpose: 'AVATAR', contentType: 'image/jpeg', sizeBytes: 1000 }).success).toBe(true);
    expect(signUploadSchema.safeParse({ purpose: 'AVATAR', contentType: 'image/gif', sizeBytes: 1000 }).success).toBe(false);
    expect(signUploadSchema.safeParse({ purpose: 'AVATAR', contentType: 'image/png', sizeBytes: 6_000_000 }).success).toBe(false);
  });

  it('upload keys cannot escape their folder', () => {
    expect(uploadKeySchema.safeParse(KEY).success).toBe(true);
    expect(uploadKeySchema.safeParse(`users/${UID}/avatar/../../secret.jpg`).success).toBe(false);
    expect(uploadKeySchema.safeParse(`users/${UID}/secret/01936b6e-7c3a-7d4e-8f00-0123456789ac.jpg`).success).toBe(false);
    expect(uploadKeySchema.safeParse(`users/${UID}/listing/01936b6e-7c3a-7d4e-8f00-0123456789ac.jpg`).success).toBe(true);
  });
});

describe('portfolio', () => {
  it('requires a title and an upload key; update needs at least one field', () => {
    expect(createPortfolioItemSchema.safeParse({ title: 'Mural', uploadKey: KEY }).success).toBe(true);
    expect(createPortfolioItemSchema.safeParse({ title: ' ', uploadKey: KEY }).success).toBe(false);
    expect(updatePortfolioItemSchema.safeParse({}).success).toBe(false);
    expect(updatePortfolioItemSchema.safeParse({ position: 10 }).success).toBe(false);
  });
});

describe('helpers', () => {
  it('emailDomain lower-cases the domain', () => {
    expect(emailDomain('A.B@CSE.IITH.ac.in')).toBe('cse.iith.ac.in');
  });
  it('domainSchema accepts bare domains only', () => {
    expect(domainSchema.parse(' IITH.ac.in ')).toBe('iith.ac.in');
    expect(domainSchema.safeParse('@iith.ac.in').success).toBe(false);
    expect(domainSchema.safeParse('https://iith.ac.in').success).toBe(false);
    expect(upsertStudentDomainSchema.parse({ domain: 'x.edu', collegeName: 'X College' }).allowed).toBe(true);
  });
  it('idParamSchema accepts UUIDs (incl. v7) only', () => {
    expect(idParamSchema.safeParse(UID).success).toBe(true);
    expect(idParamSchema.safeParse('123').success).toBe(false);
  });
});
