/**
 * Guards NFR-07: every text/background pair the app uses meets WCAG AA (4.5:1), and control
 * outlines meet 3:1 (WCAG 1.4.11), in light AND dark mode. Change a colour → this test tells you.
 */
import { palette, type ColorName } from './tokens';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT_PAIRS: [ColorName, ColorName][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'surfaceRaised'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['textMuted', 'surfaceRaised'],
  ['primary', 'background'],
  ['primary', 'primarySoft'],
  ['onPrimary', 'primary'],
  ['onDanger', 'danger'],
  ['danger', 'background'],
  ['danger', 'dangerSoft'],
  ['success', 'successSoft'],
  ['warning', 'warningSoft'],
];
const CONTROL_PAIRS: [ColorName, ColorName][] = [
  ['borderStrong', 'background'],
  ['borderStrong', 'surface'],
  ['borderStrong', 'surfaceRaised'],
];

describe.each(['light', 'dark'] as const)('%s palette contrast', (mode) => {
  const c = palette[mode];
  it.each(TEXT_PAIRS)('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(CONTROL_PAIRS)('%s on %s ≥ 3:1', (fg, bg) => {
    expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(3);
  });
});
