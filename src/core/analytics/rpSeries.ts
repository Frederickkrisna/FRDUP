/**
 * RP history transform + tier bands for the RP chart.
 *
 * `rpSeries` produces an ascending step-chart series, flagging `session_reverted`
 * events so the chart can mark them. `tierBands` derives the tier background bands
 * from TIER_LADDER, clipped to the visible [0, maxRp] range.
 */

import type { RpEventDoc } from '@/types/stats';
import { TIER_LADDER } from '@/core/ranking/ladder';
import type { RpPoint, TierBand } from './types';

/**
 * Build the ascending RP step series. Ties on createdAt are broken by event id so
 * duplicate timestamps keep a deterministic order. Reverted events remain in the
 * series (flagged) because the player's RP genuinely moved when a session was undone.
 */
export function rpSeries(events: readonly RpEventDoc[]): RpPoint[] {
  const sorted = [...events].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return sorted.map((e) => ({
    eventId: e.id,
    createdAt: e.createdAt,
    rpAfter: Math.max(0, e.rpAfter),
    tierAfter: e.tierAfter,
    delta: e.delta,
    reason: e.reason,
    reverted: e.reason === 'session_reverted',
  }));
}

/**
 * Return the tier bands intersecting [0, maxRp], in ascending RP order.
 *
 * Each band spans from its tier's rpFloor to the next tier's rpFloor (the top tier,
 * Mythic, extends to maxRp). Bands are clipped to the visible range; tiers entirely
 * above maxRp are omitted. A non-positive maxRp yields a single zero-width band for
 * the lowest tier so a chart still has something to anchor to.
 */
export function tierBands(maxRp: number): TierBand[] {
  const ceiling = Math.max(0, maxRp);
  const bands: TierBand[] = [];

  for (let i = 0; i < TIER_LADDER.length; i += 1) {
    const tier = TIER_LADDER[i];
    if (!tier) continue;

    const next = TIER_LADDER[i + 1];
    const rawFrom = tier.rpFloor;
    const rawTo = next ? next.rpFloor : Math.max(ceiling, tier.rpFloor);

    // Skip tiers that start beyond the visible ceiling (but always keep the first band).
    if (rawFrom > ceiling && i > 0) break;

    const from = Math.min(rawFrom, ceiling);
    const to = Math.min(rawTo, ceiling);

    bands.push({ tier: tier.key, from, to });

    if (rawTo >= ceiling) break;
  }

  return bands;
}
