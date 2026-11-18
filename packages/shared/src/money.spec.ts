import { MAX_AMOUNT_PAISE, formatPaise, isValidAmountPaise, rupeesToPaise } from './money.js';

describe('rupeesToPaise', () => {
  it.each([
    ['499', 49900],
    ['499.5', 49950],
    ['499.50', 49950],
    ['0.01', 1],
    ['0', 0],
    [1200, 120000],
  ])('converts %s → %d paise', (input, expected) => {
    expect(rupeesToPaise(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1.234', '1,000', '1e3', ' . '])('rejects %j', (input) => {
    expect(rupeesToPaise(input)).toBeNull();
  });

  it('avoids floating point errors (0.1 + 0.2 style)', () => {
    expect(rupeesToPaise('19.99')).toBe(1999);
    expect(rupeesToPaise('0.29')).toBe(29);
  });
});

describe('isValidAmountPaise', () => {
  it('accepts positive integers up to the cap', () => {
    expect(isValidAmountPaise(1)).toBe(true);
    expect(isValidAmountPaise(MAX_AMOUNT_PAISE)).toBe(true);
  });
  it.each([0, -1, 1.5, MAX_AMOUNT_PAISE + 1, Number.NaN, Number.POSITIVE_INFINITY])('rejects %d', (v) => {
    expect(isValidAmountPaise(v)).toBe(false);
  });
});

describe('formatPaise', () => {
  it('uses Indian digit grouping and only shows paise when non-zero', () => {
    expect(formatPaise(4995000)).toBe('₹49,950');
    expect(formatPaise(4995050)).toBe('₹49,950.50');
    expect(formatPaise(1_00_00_000 * 100)).toBe('₹1,00,00,000');
    expect(formatPaise(5)).toBe('₹0.05');
    expect(formatPaise(-25000)).toBe('-₹250');
  });
});
