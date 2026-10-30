/**
 * Rank tier ladder — Mobile-Legends-shaped, per sport.
 * See docs/implementation_be.md §6.3.1.
 */

import type { TierKey } from '@/types/rank';

export interface TierDef {
  key: TierKey;
  nameKey: string;
  /** Number of divisions (0 for Mythic — no divisions). */
  divisions: number;
  starsPerDivision: number;
  rpFloor: number;
  rpPerStar: number;
}

/** The ladder ordered from lowest to highest tier. */
export const TIER_LADDER: readonly TierDef[] = [
  { key: 'warrior',     nameKey: 'rank.tier.warrior',     divisions: 3, starsPerDivision: 3, rpFloor: 0,    rpPerStar: 50 },
  { key: 'elite',       nameKey: 'rank.tier.elite',       divisions: 4, starsPerDivision: 3, rpFloor: 450,  rpPerStar: 50 },
  { key: 'master',      nameKey: 'rank.tier.master',      divisions: 4, starsPerDivision: 3, rpFloor: 1050, rpPerStar: 50 },
  { key: 'grandmaster', nameKey: 'rank.tier.grandmaster', divisions: 5, starsPerDivision: 3, rpFloor: 1650, rpPerStar: 50 },
  { key: 'epic',        nameKey: 'rank.tier.epic',        divisions: 5, starsPerDivision: 3, rpFloor: 2400, rpPerStar: 50 },
  { key: 'legend',      nameKey: 'rank.tier.legend',      divisions: 5, starsPerDivision: 3, rpFloor: 3150, rpPerStar: 50 },
  { key: 'mythic',      nameKey: 'rank.tier.mythic',      divisions: 0, starsPerDivision: 0, rpFloor: 3900, rpPerStar: 50 },
] as const;

/** Map for O(1) lookup. */
export const TIER_MAP: Readonly<Record<TierKey, TierDef>> = Object.fromEntries(
  TIER_LADDER.map((t) => [t.key, t]),
) as Record<TierKey, TierDef>;
