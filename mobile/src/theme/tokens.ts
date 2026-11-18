/**
 * Design tokens — the only place colours, spacing, radii and type sizes are defined.
 * Components read them through useTheme(); never hard-code a colour in a screen.
 *
 * Accessibility (NFR-07): text/background pairs below meet WCAG AA contrast (≥ 4.5:1 for
 * body text). If you change a colour, re-check contrast (e.g. webaim.org/resources/contrastchecker).
 */
export const palette = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F3FA',
    surfaceRaised: '#FFFFFF',
    border: '#DDD8E8',
    /** Outlines of controls (inputs, checkboxes, unselected pills, empty stars): ≥ 3:1 (WCAG 1.4.11). */
    borderStrong: '#857F95',
    text: '#17141F',
    textMuted: '#5B5668',
    primary: '#6D28D9',
    onPrimary: '#FFFFFF',
    primarySoft: '#EDE7FB',
    danger: '#B42318',
    onDanger: '#FFFFFF',
    dangerSoft: '#FEE4E2',
    success: '#067647',
    successSoft: '#DCFAE6',
    warning: '#93370D',
    warningSoft: '#FEF0C7',
  },
  dark: {
    background: '#0F0E13',
    surface: '#1C1A23',
    surfaceRaised: '#25222E',
    border: '#34303F',
    borderStrong: '#7D7790',
    text: '#F4F2F8',
    textMuted: '#B3AEC0',
    primary: '#C4B5FD',
    onPrimary: '#1E0F45',
    primarySoft: '#2A2140',
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

/** Minimum touch target (NFR-07). */
export const MIN_TOUCH_SIZE = 48;

export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;
