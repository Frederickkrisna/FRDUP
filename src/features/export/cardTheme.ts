/**
 * Per-template visual descriptor. Values are CSS custom-property references (defined in export.css
 * and tokens.css) — never raw hex — so the HEX_COLOR lint rule stays satisfied in feature code.
 * Pure data; no React.
 */

import type { CardFormat, CardTemplateId, TierUpCardData } from './types';
import type { TierKey } from '@/types/rank';

export interface CardTheme {
  bg: string;
  ground: string;
  panel: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  hair: string;
  accent: string;
  /** Text colour that reads on top of `accent`. */
  accentOn: string;
  /** `color-scheme` the off-screen stage should declare for this template. */
  colorScheme: 'dark' | 'light';
}

export const CARD_THEME: Record<CardTemplateId, CardTheme> = {
  court: {
    bg: 'var(--xc-court-bg)',
    ground: 'var(--xc-court-ground)',
    panel: 'var(--xc-court-panel)',
    ink: 'var(--xc-court-ink)',
    inkMuted: 'var(--xc-court-ink-muted)',
    inkFaint: 'var(--xc-court-ink-faint)',
    hair: 'var(--xc-court-line-dim)',
    accent: 'var(--xc-court-line)',
    accentOn: 'var(--xc-court-bg)',
    colorScheme: 'dark',
  },
  night: {
    bg: 'var(--xc-night-bg)',
    ground: 'var(--xc-night-ground)',
    panel: 'var(--xc-night-panel)',
    ink: 'var(--xc-night-ink)',
    inkMuted: 'var(--xc-night-ink-muted)',
    inkFaint: 'var(--xc-night-ink-faint)',
    hair: 'var(--xc-night-hair)',
    accent: 'var(--c-primary)',
    accentOn: 'var(--c-primary-on)',
    colorScheme: 'dark',
  },
  paper: {
    bg: 'var(--xc-paper-bg)',
    ground: 'var(--xc-paper-card)',
    panel: 'var(--xc-paper-card)',
    ink: 'var(--xc-paper-ink)',
    inkMuted: 'var(--xc-paper-ink-muted)',
    inkFaint: 'var(--xc-paper-ink-faint)',
    hair: 'var(--xc-paper-line)',
    accent: 'var(--xc-paper-accent)',
    accentOn: 'var(--xc-paper-card)',
    colorScheme: 'light',
  },
};

/** The sport accent CSS variable for a given sport id. */
export function sportAccentVar(sportId: string): string {
  return `var(--sport-${sportId})`;
}

/** Solid tier colour (for chips/glows) as a CSS variable reference. */
export function tierSolidVar(tier: TierKey): string {
  return `var(--tier-${tier})`;
}

/** Tier gradient stops as CSS variable references. */
export function tierGradientVars(tier: TierKey): { from: string; to: string } {
  return { from: `var(--tier-${tier}-from)`, to: `var(--tier-${tier}-to)` };
}

/** Geometry that scales podium/typography between feed and the taller story format. */
export interface CardMetrics {
  pad: number;
  titleSize: number;
  podiumMax: number;
  avatarPodium: number;
  rowGap: number;
  rowHeight: number;
  nameMax: number;
}

export function cardMetrics(format: CardFormat): CardMetrics {
  if (format === 'story') {
    return { pad: 88, titleSize: 68, podiumMax: 420, avatarPodium: 150, rowGap: 14, rowHeight: 96, nameMax: 18 };
  }
  return { pad: 72, titleSize: 58, podiumMax: 300, avatarPodium: 124, rowGap: 12, rowHeight: 84, nameMax: 16 };
}

/** The tier-up card reuses the same theme map; this picks a default template for it. */
export function tierUpAccent(data: TierUpCardData): string {
  return tierSolidVar(data.to.key);
}
