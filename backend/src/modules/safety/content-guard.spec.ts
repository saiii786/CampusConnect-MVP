import { assertContentAllowed, findContentProblem } from './content-guard.js';

describe('content guard (FR-603)', () => {
  it('allows normal text, including one or two links and Indian-language words', () => {
    expect(findContentProblem('I paint walls in Kukatpally. Portfolio: https://example.com/work')).toBeNull();
    expect(findContentProblem('Namaste! Maths tuition for class 10, ₹300/hour.')).toBeNull();
    expect(findContentProblem('Payment after the job is done, via the app.')).toBeNull();
  });

  it('refuses common scam phrases regardless of case and spacing', () => {
    expect(findContentProblem('Pay REGISTRATION   fee of 500 first')).toMatch(/registration fee/);
    expect(findContentProblem('please send me the OTP you received')).toMatch(/otp/i);
    expect(findContentProblem('Tell me your UPI PIN')).toMatch(/upi pin/);
  });

  it('refuses link spam and character floods', () => {
    expect(findContentProblem('a https://a.co b https://b.co c www.c.co d https://d.co')).toMatch(/links/);
    expect(findContentProblem(`Buy now${'!'.repeat(40)}`)).toMatch(/repeated/);
  });

  it('assertContentAllowed throws 422 CONTENT_NOT_ALLOWED and ignores empty values', () => {
    expect(() => assertContentAllowed('fine', null, undefined, '')).not.toThrow();
    expect(() => assertContentAllowed('ok', 'joining fee required')).toThrow(expect.objectContaining({ code: 'CONTENT_NOT_ALLOWED', status: 422 }));
  });
});
