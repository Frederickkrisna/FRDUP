/**
 * Shared chart helpers for the analytics feature: CSS-variable colour strings,
 * number/date formatters (Asia/Jakarta, id-ID), and a reduced-motion hook.
 *
 * Colours are returned as `var(--token)` strings — recharts passes these straight
 * into SVG `stroke`/`fill`, where CSS variables resolve against :root in tokens.css.
 */

import { useSyncExternalStore } from 'react';
import type { TierKey } from '@/types/rank';
import { formatDateShort } from '@/core/utils/date';

/** Semantic colour tokens used across the charts. */
export const CHART_COLOR = {
  primary: 'var(--c-primary)',
  success: 'var(--c-success)',
  danger: 'var(--c-danger)',
  info: 'var(--c-info)',
  warning: 'var(--c-warning)',
  grid: 'var(--c-border)',
  axis: 'var(--c-text-faint)',
  surface: 'var(--c-surface-2)',
  line: 'var(--c-border-strong)',
} as const;

/** Resolve a tier key to its solid CSS-variable colour string. */
export function tierColor(tier: TierKey): string {
  return `var(--tier-${tier})`;
}

const NUMBER_FORMATTER = new Intl.NumberFormat('id-ID');
const DECIMAL_FORMATTER = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Format an integer with id-ID grouping (e.g. 1.200). */
export function formatInt(value: number): string {
  return NUMBER_FORMATTER.format(Math.round(value));
}

/** Format a decimal with up to one fraction digit, id-ID style. */
export function formatDecimal(value: number): string {
  return DECIMAL_FORMATTER.format(value);
}

/** Format a 0..1 ratio as a whole-percent string (e.g. "75%"). */
export function formatPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Format epoch millis for an axis tick (short date, Asia/Jakarta). */
export function formatAxisDate(millis: number): string {
  return formatDateShort(millis);
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * React hook: true when the user prefers reduced motion. SSR-safe (the server snapshot
 * is always false). Used to disable recharts animations.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
}
