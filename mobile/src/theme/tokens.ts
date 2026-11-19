/**
 * Design tokens — the only place colours, spacing, radii and type sizes are defined.
 * Components read them through useTheme(); never hard-code a colour in a screen.
 *
 * Accessibility (NFR-07): text/background pairs below meet WCAG AA contrast (≥ 4.5:1 for
 * body text). If you change a colour, re-check contrast (e.g. webaim.org/resources/contrastchecker).
 */
/**
 * Brand "Connect" (ADR-030): indigo = trust, marigold = warmth / India. Logo colours: indigo #4338CA,
 * deep indigo #272379, marigold #F5B301 (mobile/assets/brand). Marigold is too light for text on white —
 * use `accent` only as a fill with `onAccent` text, or on dark backgrounds.
 */
export const palette = {
  light: {
    background: '#FFFFFF',
    surface: '#F4F5FB',
    surfaceRaised: '#FFFFFF',
    border: '#DFE1EE',
    /** Outlines of controls (inputs, checkboxes, unselected pills, empty stars): ≥ 3:1 (WCAG 1.4.11). */
    borderStrong: '#7E8299',
    text: '#12142B',
    textMuted: '#565A72',
    primary: '#4338CA',
    onPrimary: '#FFFFFF',
    primarySoft: '#ECEEFF',
    accent: '#F5B301',
    onAccent: '#2B1D00',
    accentSoft: '#FFF4D1',
    danger: '#B42318',
    onDanger: '#FFFFFF',
    dangerSoft: '#FEE4E2',
    success: '#067647',
    successSoft: '#DCFAE6',
    warning: '#93370D',
    warningSoft: '#FEF0C7',
  },
  dark: {
    background: '#0D0F1E',
    surface: '#171A2E',
    surfaceRaised: '#20243B',
    border: '#2F3450',
    borderStrong: '#7A80A0',
    text: '#F2F3FA',
    textMuted: '#AEB2CA',
    primary: '#A9B4FF',
    onPrimary: '#1A1650',
    primarySoft: '#252A55',
    accent: '#F5B301',
    onAccent: '#2B1D00',
    accentSoft: '#33280A',
    danger: '#F97066',
    onDanger: '#3A1513',
    dangerSoft: '#3A1513',
    success: '#47CD89',
    successSoft: '#0E2C1E',
    warning: '#FDB022',
    warningSoft: '#33240A',
  },
} as const;

export type ColorName = keyof typeof palette.light;
export type Colors = Record<ColorName, string>;

/** 4-point spacing scale (xxs for tight label/caption stacks). */
export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

/**
 * Poppins (free, Google Fonts; also covers Devanagari for future Hindi) — loaded in app/_layout.tsx.
 * Each weight is its own font file: set `fontFamily: fonts.bold`, never `fontWeight` (Android would
 * fall back to the system font).
 */
export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

/** Minimum touch target (NFR-07). */
export const MIN_TOUCH_SIZE = 48;

export const typography = {
  title: { fontSize: 28, lineHeight: 36, fontFamily: fonts.bold },
  heading: { fontSize: 20, lineHeight: 28, fontFamily: fonts.semibold },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fonts.regular },
  label: { fontSize: 14, lineHeight: 20, fontFamily: fonts.semibold },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fonts.regular },
} as const;

export type TypographyVariant = keyof typeof typography;
