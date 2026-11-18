/**
 * Money helpers. All money in the system is an integer number of paise (₹1 = 100 paise),
 * never a floating-point number (ADR-006).
 */

/** Largest single amount accepted anywhere in the MVP: ₹10,00,000 (10 lakh). */
export const MAX_AMOUNT_PAISE = 10_00_000 * 100;

/** True if `value` is a valid positive amount in paise. */
export function isValidAmountPaise(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_AMOUNT_PAISE;
}

/**
 * Convert a rupee amount typed by a user (e.g. "499.50") to paise.
 * Returns null for anything that is not a non-negative amount with at most 2 decimals.
 */
export function rupeesToPaise(input: string | number): number | null {
  const text = String(input).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(paise) ? paise : null;
}

/** Format paise as Indian rupees, e.g. 4995000 → "₹49,950" and 4995050 → "₹49,950.50". */
export function formatPaise(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = rupees.toLocaleString('en-IN');
  return `${sign}₹${grouped}${rest ? '.' + String(rest).padStart(2, '0') : ''}`;
}
