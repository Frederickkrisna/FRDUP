/**
 * Pure layout logic for the export cards. No React, no DOM — kept here so the row-cap, podium
 * degradation, name truncation and filename rules are unit-testable in plain Node.
 */

import type { CardEntry, CardFormat, CardTemplateId } from './types';

/**
 * How many rows (below the podium) each template fits per format. Story has more vertical room
 * than feed, and `paper` (a receipt) runs its list tighter than the two display templates.
 */
const ROW_CAP: Record<CardTemplateId, Record<CardFormat, number>> = {
  court: { feed: 7, story: 11 },
  night: { feed: 7, story: 11 },
  paper: { feed: 8, story: 13 },
};

/** The podium always wants the top three; the remaining entries flow into the list. */
export interface PodiumLayout {
  /** 0–3 entries in podium display order: [second, first, third] where present. */
  podium: CardEntry[];
  /** The first (rank 1) entry, or null when there are no entries. */
  leader: CardEntry | null;
  /** Entries below the podium, capped to what fits. */
  rows: CardEntry[];
  /** Entries that did not fit and are summarised by the "+N more" line (0 when none). */
  overflow: number;
  /** Whether a meaningful podium can be drawn (>= 1 entry). */
  hasPodium: boolean;
}

/** Visual podium ordering: silver on the left, gold centre, bronze on the right. */
export function podiumDisplayOrder(top: CardEntry[]): CardEntry[] {
  const [first, second, third] = top;
  const order: CardEntry[] = [];
  if (second) order.push(second);
  if (first) order.push(first);
  if (third) order.push(third);
  return order;
}

/** Relative podium column heights (0..1) by display position, given how many are present. */
export function podiumHeights(count: number): { first: number; second: number; third: number } {
  if (count <= 1) return { first: 1, second: 0, third: 0 };
  if (count === 2) return { first: 1, second: 0.74, third: 0 };
  return { first: 1, second: 0.74, third: 0.56 };
}

/**
 * Decide the podium / rows / overflow split for a template and format. Degrades sensibly for
 * 0–2 entries (fewer podium columns) and caps the visible list, reporting the hidden remainder.
 */
export function computeLayout(
  entries: CardEntry[],
  template: CardTemplateId,
  format: CardFormat,
): PodiumLayout {
  const top = entries.slice(0, 3);
  const rest = entries.slice(3);
  const cap = ROW_CAP[template][format];
  const rows = rest.slice(0, cap);
  const overflow = Math.max(0, rest.length - rows.length);
  return {
    podium: podiumDisplayOrder(top),
    leader: entries[0] ?? null,
    rows,
    overflow,
    hasPodium: entries.length > 0,
  };
}

/** The number of list rows a template/format can show below the podium (exposed for tests/UI). */
export function rowCapFor(template: CardTemplateId, format: CardFormat): number {
  return ROW_CAP[template][format];
}

/**
 * Truncate a display name to a sensible length without cutting a surrogate pair or combining mark
 * in half. Appends an ellipsis character when shortened. A one-letter name is returned unchanged.
 */
export function truncateName(name: string, max: number): string {
  const trimmed = name.trim();
  const chars = Array.from(trimmed);
  if (chars.length <= max) return trimmed;
  // Keep max-1 glyphs and add an ellipsis so the result stays within `max` visible units.
  return `${chars.slice(0, Math.max(1, max - 1)).join('')}\u2026`;
}

/** Choose the shortest sensible label for a name: nickname when present, else the full name. */
export function displayName(entry: Pick<CardEntry, 'name' | 'nickname'>): string {
  const nick = entry.nickname?.trim();
  return nick && nick.length > 0 ? nick : entry.name;
}
