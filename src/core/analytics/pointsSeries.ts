/**
 * Points-for / points-against series transform.
 * Per-match averages guard against matchesPlayed === 0 (yield 0, never NaN/Infinity).
 */

import type { PlayerSessionResultDoc } from '@/types/player';
import type { AnalyticsWindow, PointsPoint } from './types';
import { sortAscending, takeMostRecent } from './util';

/** Build the chronological points series for the most recent `window` sessions. */
export function pointsSeries(
  results: readonly PlayerSessionResultDoc[],
  window: AnalyticsWindow,
): PointsPoint[] {
  const sorted = sortAscending(results);
  const windowed = takeMostRecent(sorted, window);

  return windowed.map((r) => {
    const matches = Math.max(0, r.matchesPlayed);
    const pointsFor = Math.max(0, r.pointsFor);
    const pointsAgainst = Math.max(0, r.pointsAgainst);

    return {
      sessionId: r.sessionId,
      playedAt: r.playedAt,
      pointsFor,
      pointsAgainst,
      perMatchFor: matches > 0 ? roundTo(pointsFor / matches, 1) : 0,
      perMatchAgainst: matches > 0 ? roundTo(pointsAgainst / matches, 1) : 0,
    };
  });
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
