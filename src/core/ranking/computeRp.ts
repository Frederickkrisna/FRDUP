/**
 * Rank point computation functions.
 * computeSessionRp: how many RP a player earns/loses for a session result.
 * applyRp: applies a delta to current RP with tier-floor protection.
 * rpToPosition: converts raw RP to a visual rank position.
 * See docs/implementation_be.md §6.3.2–6.3.3.
 */

import type { TierKey } from '@/types/rank';
import type { RpBreakdown } from '@/types/stats';
import { TIER_LADDER, TIER_MAP } from './ladder';
import type { StandingRow } from '@/core/matchmaking/types';

export interface RankPosition {
  rp: number;
  tier: TierKey;
  division: number;
  stars: number;
  starsInDivision: number;
  rpToNextStar: number;
  progressPct: number;
  /** Mythic only. */
  mythicPoints?: number;
}

/** Convert raw RP to a visual rank position. Table-driven, O(tiers) = O(7). */
export function rpToPosition(rp: number): RankPosition {
  const clampedRp = Math.max(0, rp);

  // Find the highest tier whose rpFloor ≤ rp
  let tierDef = TIER_LADDER[0]!;
  for (const t of TIER_LADDER) {
    if (clampedRp >= t.rpFloor) {
      tierDef = t;
    }
  }

  if (tierDef.key === 'mythic') {
    const mythicPoints = Math.floor((clampedRp - tierDef.rpFloor) / 10);
    return {
      rp: clampedRp,
      tier: 'mythic',
      division: 0,
      stars: 0,
      starsInDivision: 0,
      rpToNextStar: 0,
      progressPct: 1,
      mythicPoints,
    };
  }

  const offset = clampedRp - tierDef.rpFloor;
  const rpPerStar = tierDef.rpPerStar;
  const starIndex = Math.floor(offset / rpPerStar); // 0-based across the whole tier
  const divFromBase = Math.floor(starIndex / tierDef.starsPerDivision);
  // division 1 is the TOP one (highest), division N is the lowest
  const division = tierDef.divisions - divFromBase;
  const stars = starIndex % tierDef.starsPerDivision;
  const rpInStar = offset % rpPerStar;

  return {
    rp: clampedRp,
    tier: tierDef.key,
    division,
    stars,
    starsInDivision: tierDef.starsPerDivision,
    rpToNextStar: rpPerStar - rpInStar,
    progressPct: rpInStar / rpPerStar,
  };
}

/**
 * Compute RP earned/lost for a session.
 * Gate: fewer than minMatchesGate matches played → 0 delta.
 * See docs/implementation_be.md §6.3.2.
 */
export function computeSessionRp(args: {
  standing: StandingRow;
  participantCount: number;
  streakSessions: number;
  minMatchesGate?: number;
}): { delta: number; breakdown: RpBreakdown } {
  const { standing, participantCount, streakSessions, minMatchesGate = 3 } = args;

  if (standing.matchesPlayed < minMatchesGate) {
    return {
      delta: 0,
      breakdown: { placement: 0, winRate: 0, pointDiff: 0, participation: 0, clampApplied: false },
    };
  }

  // 1. Placement — the dominant term
  const pct =
    participantCount > 1
      ? (participantCount - standing.rank) / (participantCount - 1)
      : 1;
  const placement = Math.round(lerp(-10, 30, pct));

  // 2. Win rate — rewards consistency
  const winRate = standing.wins / Math.max(1, standing.matchesPlayed);
  const winRateRp = Math.round((winRate - 0.5) * 20);

  // 3. Point differential — rewards margin, capped so blowouts don't dominate
  const avgDiff = standing.pointDiff / Math.max(1, standing.matchesPlayed);
  const diffRp = clamp(Math.round(avgDiff * 1.5), -10, 10);

  // 4. Participation streak — showing up is worth something
  const participation = Math.min(streakSessions, 5);

  const raw = placement + winRateRp + diffRp + participation;
  const delta = clamp(raw, -20, 50);

  return {
    delta,
    breakdown: {
      placement,
      winRate: winRateRp,
      pointDiff: diffRp,
      participation,
      clampApplied: raw !== delta,
    },
  };
}

/**
 * Apply a RP delta with tier-floor protection.
 * Once you reach a tier, you never fall out of it — you can only lose stars within it.
 * See docs/implementation_be.md §6.3.3.
 */
export function applyRp(
  currentRp: number,
  delta: number,
): {
  rpAfter: number;
  from: RankPosition;
  to: RankPosition;
  tierChanged: boolean;
  promoted: boolean;
  floorProtected: boolean;
} {
  const from = rpToPosition(currentRp);
  const tierDef = TIER_MAP[from.tier]!;
  const floorRp = tierDef.rpFloor;

  const rawAfter = currentRp + delta;
  const rpAfter = Math.max(rawAfter, floorRp, 0);
  const floorProtected = rawAfter < floorRp;

  const to = rpToPosition(rpAfter);

  return {
    rpAfter,
    from,
    to,
    tierChanged: from.tier !== to.tier,
    promoted: to.rp > from.rp && from.tier !== to.tier,
    floorProtected,
  };
}

// ---- pure helpers ----

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
