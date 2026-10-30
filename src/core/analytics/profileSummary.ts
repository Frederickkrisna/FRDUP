/**
 * Profile summary numbers for the StatTile grid + the data-sufficiency gate.
 */

import type { PlayerSessionResultDoc, PlayerSportStatsDoc } from '@/types/player';
import type { ProfileSummary } from './types';

/** Minimum sessions before charts are worth showing. */
export const MIN_SESSIONS_FOR_CHARTS = 3;

/**
 * Reduce a stats doc to the handful of numbers the StatTile grid shows.
 * All divisions are guarded. A null stats doc (player with no stats yet) yields zeros.
 */
export function profileSummary(stats: PlayerSportStatsDoc | null): ProfileSummary {
  if (!stats) {
    return { matches: 0, wins: 0, winRatePct: 0, sessions: 0, peakRp: 0, longestStreak: 0 };
  }

  const matches = Math.max(0, stats.matchesPlayed);
  const wins = Math.max(0, stats.wins);
  const winRatePct = matches > 0 ? Math.round((wins / matches) * 100) : 0;

  return {
    matches,
    wins,
    winRatePct,
    sessions: Math.max(0, stats.sessionsPlayed),
    peakRp: Math.max(0, stats.peakRp),
    longestStreak: Math.max(0, stats.longestStreak),
  };
}

/** True when there are at least `min` session results to plot. */
export function hasEnoughData(
  results: readonly PlayerSessionResultDoc[],
  min: number = MIN_SESSIONS_FOR_CHARTS,
): boolean {
  return results.length >= min;
}
