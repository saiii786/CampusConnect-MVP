import { LEGAL_DOCS } from './legal';

describe('legal documents (FR-604)', () => {
  it('terms, privacy and guidelines exist with dated, non-empty sections', () => {
    for (const id of ['terms', 'privacy', 'guidelines'] as const) {
      const doc = LEGAL_DOCS[id];
      expect(doc.title).toBeTruthy();
      expect(doc.updated).toMatch(/\d{4}/);
      expect(doc.sections.length).toBeGreaterThan(2);
      for (const s of doc.sections) {
        expect(s.heading.trim()).not.toBe('');
        expect(s.body.length).toBeGreaterThan(30);
      }
    }
  });

  it('states the key promises: test-mode money, 18+, no contact details shown, no scams', () => {
    expect(JSON.stringify(LEGAL_DOCS.terms)).toMatch(/TEST MODE/);
    expect(JSON.stringify(LEGAL_DOCS.terms)).toMatch(/18 years/);
    expect(JSON.stringify(LEGAL_DOCS.privacy)).toMatch(/Never your email, phone number/);
    expect(JSON.stringify(LEGAL_DOCS.guidelines)).toMatch(/registration fee/);
  });
});
