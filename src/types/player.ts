/** Roster player and stats DTOs. Mirrors docs/api_contract.md §4.2–4.4. */

import type { Id, Millis } from './common';
import type { SportId } from './sport';
import type { TierKey } from './rank';

export interface PlayerSportSummary {
  tier: TierKey;
  division: number;
  stars: number;
  rp: number;
  matchesPlayed: number;
  wins: number;
  sessionsPlayed: number;
  lastPlayedAt: Millis | null;
}

export interface RosterPlayerDoc {
  id: Id;
  schemaVersion: number;
  hostId: Id;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  /** Deterministic fallback swatch hex. */
  avatarColor: string;
  phone: string | null;
  notes: string | null;
  isGuest: boolean;
  archivedAt: Millis | null;
  createdAt: Millis;
  updatedAt: Millis;
  /** Denormalised for fast roster-grid rendering. Recomputed on session finish. */
  summary: Partial<Record<SportId, PlayerSportSummary>>;
}

/** Input shape for rosterRepo.create / createMany. */
export interface NewPlayerInput {
  name: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  isGuest?: boolean;
}

/** Full per-sport stats doc. Mirrors docs/api_contract.md §4.3. */
export interface PlayerSportStatsDoc {
  id: SportId;
  schemaVersion: number;
  playerId: Id;
  sportId: SportId;
  rp: number;
  tier: TierKey;
  division: number;
  stars: number;
  peakRp: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  sessionsPlayed: number;
  podiumFinishes: { first: number; second: number; third: number };
  currentStreak: number;
  longestStreak: number;
  lastPlayedAt: Millis | null;
  updatedAt: Millis;
}

/** Pre-aggregated per-session result for analytics charts. Mirrors api_contract.md §4.4. */
export interface PlayerSessionResultDoc {
  id: Id;
  schemaVersion: number;
  playerId: Id;
  sessionId: Id;
  sportId: SportId;
  playedAt: Millis;
  rank: number;
  participantCount: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  winRate: number;
  rpDelta: number;
  rpAfter: number;
  tierAfter: TierKey;
  divisionAfter: number;
  starsAfter: number;
}
