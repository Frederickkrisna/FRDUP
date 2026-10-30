/**
 * Win-rate series transform.
 * Firestore may return results newest-first; we always sort ascending by playedAt
 * (ties broken by sessionId for determinism) and keep only the most recent `window`.
 */

import type { PlayerSessionResultDoc } from '@/types/player';
import type { AnalyticsWindow, WinRatePoint } from './types';
import { sortAscending, takeMostRecent } from './util';

/**
 * Build the chronological win-rate series for the most recent `window` sessions.
 *
 * - `winRate` is the session's own win rate (0..1). We trust the stored `winRate`
 *   when matchesPlayed > 0, otherwise derive it from wins/matchesPlayed, guarding /0.
 * - `cumulativeWinRate` is wins/matches aggregated across the window up to this point.
 */
export function winRateSeries(
  results: readonly PlayerSessionResultDoc[],
  window: AnalyticsWindow,
): WinRatePoint[] {
  const sorted = sortAscending(results);
  const windowed = takeMostRecent(sorted, window);

  let cumulativeWins = 0;
  let cumulativeMatches = 0;

  return windowed.map((r) => {
    const matches = Math.max(0, r.matchesPlayed);
    const sessionWinRate = matches > 0 ? r.wins / matches : 0;

    cumulativeWins += r.wins;
    cumulativeMatches += matches;
    const cumulativeWinRate = cumulativeMatches > 0 ? cumulativeWins / cumulativeMatches : 0;

    return {
      sessionId: r.sessionId,
      playedAt: r.playedAt,
      winRate: clamp01(sessionWinRate),
      cumulativeWinRate: clamp01(cumulativeWinRate),
    };
  });
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
