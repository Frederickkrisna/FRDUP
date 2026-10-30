/**
 * Output shapes for the player-analytics transforms.
 * Pure data — no React, no DOM, no Firebase. Consumed by src/features/analytics charts.
 * See docs/design.md §6.4 (Player profile) and docs/api_contract.md §4.3–4.4, §4.9.
 */

import type { Id, Millis } from '@/types/common';
import type { TierKey } from '@/types/rank';

/** The rolling window size offered in the UI segmented control. */
export type AnalyticsWindow = 5 | 10 | 20;

/** One point on the win-rate chart (chronological, oldest → newest). */
export interface WinRatePoint {
  sessionId: Id;
  playedAt: Millis;
  /** Win rate for this single session, 0..1. */
  winRate: number;
  /** Running win rate across the window up to and including this session, 0..1. */
  cumulativeWinRate: number;
}

/** One point on the points-for / points-against chart. */
export interface PointsPoint {
  sessionId: Id;
  playedAt: Millis;
  pointsFor: number;
  pointsAgainst: number;
  /** Per-match average; guarded so matchesPlayed === 0 yields 0 rather than NaN. */
  perMatchFor: number;
  perMatchAgainst: number;
}

/** One step on the RP history chart. */
export interface RpPoint {
  eventId: Id;
  createdAt: Millis;
  rpAfter: number;
  tierAfter: TierKey;
  delta: number;
  reason: 'session_result' | 'manual_adjust' | 'session_reverted';
  /** True when the event undoes a previously committed session. */
  reverted: boolean;
}

/** A horizontal tier band for the RP chart background, in RP units. */
export interface TierBand {
  tier: TierKey;
  /** Inclusive lower RP bound of the visible band (clamped to 0). */
  from: number;
  /** Exclusive-ish upper RP bound of the visible band (clamped to maxRp). */
  to: number;
}

/** Numbers for the StatTile grid on the profile. */
export interface ProfileSummary {
  matches: number;
  wins: number;
  /** Win percentage as an integer 0..100. */
  winRatePct: number;
  sessions: number;
  peakRp: number;
  longestStreak: number;
}
