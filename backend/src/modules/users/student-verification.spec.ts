import { detectImageType } from '../uploads/image-signature.js';
import { domainCandidates } from './student-verification.service.js';

describe('domainCandidates', () => {
  it('lists the domain and its parents, most specific first, without the TLD', () => {
    expect(domainCandidates('cse.iith.ac.in')).toEqual(['cse.iith.ac.in', 'iith.ac.in', 'ac.in']);
    expect(domainCandidates('stanford.edu')).toEqual(['stanford.edu']);
  });
});

describe('detectImageType', () => {
  it('recognises JPEG, PNG and WebP by their first bytes and nothing else', () => {
    expect(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(detectImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(detectImageType(new TextEncoder().encode('<html><script>'))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});
