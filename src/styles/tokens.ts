/** Design tokens — the only place these hexes may appear. See docs/design.md §2–4. */

export const colors = {
  bg: '#0A0E13',
  surface: '#121922',
  surface2: '#1A232E',
  surface3: '#233040',
  border: '#27343F',
  borderStrong: '#3A4A59',
  text: '#EAF1F8',
  textMuted: '#93A5B6',
  textFaint: '#7B8C9D',
  overlay: '#0A0E13CC',

  primary: '#B8FF3C',
  primaryOn: '#0A0E13',
  primaryDim: '#7FB328',

  success: '#34D399',
  successOn: '#06231A',
  danger: '#F43F5E',
  dangerOn: '#FFF1F3',
  warning: '#FBBF24',
  warningOn: '#231A03',
  info: '#38BDF8',
  infoOn: '#04202E',
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const touchTarget = {
  scoreButton: 64,
  scorePadKey: 56,
  primaryButton: 52,
  listRow: 48,
  minimum: 44,
} as const;

/** Type roles (docs/design.md §3). Sizes in px; weights map to the self-hosted font files. */
export const typography = {
  display: { family: 'sans', weight: 800, fontSize: 32, lineHeight: 38 },
  title: { family: 'sans', weight: 700, fontSize: 22, lineHeight: 28 },
  subtitle: { family: 'sans', weight: 600, fontSize: 17, lineHeight: 24 },
  body: { family: 'sans', weight: 400, fontSize: 15, lineHeight: 22 },
  label: { family: 'sans', weight: 600, fontSize: 13, lineHeight: 18, letterSpacing: 0.26 },
  caption: { family: 'sans', weight: 400, fontSize: 12, lineHeight: 16 },
  scoreXl: { family: 'mono', weight: 700, fontSize: 64, lineHeight: 64 },
  scoreLg: { family: 'mono', weight: 700, fontSize: 36, lineHeight: 40 },
  numeric: { family: 'mono', weight: 500, fontSize: 15, lineHeight: 22 },
} as const;
export type ColorToken = keyof typeof colors;
