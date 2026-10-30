/**
 * Shared helpers for the analytics transforms. Pure, dependency-free.
 */

import type { PlayerSessionResultDoc } from '@/types/player';

/**
 * Sort session results ascending by playedAt. Ties (duplicate timestamps) are broken
 * by sessionId so the ordering is stable and deterministic regardless of input order.
 * Does not mutate the input.
 */
export function sortAscending(
  results: readonly PlayerSessionResultDoc[],
): PlayerSessionResultDoc[] {
  return [...results].sort((a, b) => {
    if (a.playedAt !== b.playedAt) return a.playedAt - b.playedAt;
    return a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0;
  });
}

/**
 * Keep only the most recent `window` entries from an already-ascending array.
 * A window larger than the data returns the whole array.
 */
export function takeMostRecent<T>(ascending: readonly T[], window: number): T[] {
  if (window <= 0) return [];
  if (ascending.length <= window) return [...ascending];
  return ascending.slice(ascending.length - window);
}
