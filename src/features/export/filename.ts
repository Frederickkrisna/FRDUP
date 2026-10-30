/**
 * Export filename builder. Pure (no DOM) so it is unit-testable. Produces names like
 * `frdup-badminton-2026-09-12-feed.png`.
 */

import type { CardFormat } from './types';
import type { SportId } from '@/types/sport';

export type ExportKind = 'session' | 'alltime' | 'tierup';

/** Reduce an arbitrary date input to a `YYYY-MM-DD` slug, falling back to the ISO date part. */
function dateSlug(dateIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso.trim());
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(dateIso);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return 'undated';
}

/** Lowercase, keep a-z0-9 and single hyphens — safe across Android/iOS file pickers. */
function slug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Build the download/share filename for a card. Always ends in `.png`. */
export function exportFilename(
  kind: ExportKind,
  sportId: SportId,
  dateIso: string,
  format: CardFormat,
): string {
  const parts = ['frdup', slug(sportId), dateSlug(dateIso), format];
  if (kind === 'tierup') parts.splice(1, 0, 'tierup');
  return `${parts.filter(Boolean).join('-')}.png`;
}
