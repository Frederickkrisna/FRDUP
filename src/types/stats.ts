/** Stats, ranking events, join codes, and co-host DTOs. Mirrors api_contract.md §4.8–4.10 + §5.3. */

import type { Id, Millis } from './common';
import type { SportId } from './sport';
import type { TierKey } from './rank';
import type { PlayerSessionResultDoc, PlayerSportStatsDoc, PlayerSportSummary } from './player';

export interface RpBreakdown {
  placement: number;
  winRate: number;
  pointDiff: number;
  participation: number;
  clampApplied: boolean;
}

export interface RpEventDoc {
  id: Id;
  schemaVersion: number;
  playerId: Id;
  sportId: SportId;
  sessionId: Id | null;
  reason: 'session_result' | 'manual_adjust' | 'session_reverted';
  breakdown: RpBreakdown;
  delta: number;
  rpBefore: number;
  rpAfter: number;
  tierBefore: TierKey;
  tierAfter: TierKey;
  createdAt: Millis;
}

/** 6-char join-code lookup document. Mirrors api_contract.md §4.8. */
export interface SessionCodeDoc {
  id: string;
  sessionId: Id;
  hostAnonUid: string;
  expiresAt: Millis;
  createdAt: Millis;
}

/** Co-host device document. Mirrors api_contract.md §4.10. */
export interface CoHostDoc {
  id: string;
  sessionId: Id;
  label: string;
  joinedAt: Millis;
  claimedCourtIds: Id[];
  lastSeenAt: Millis;
}

/** Payload for statsRepo.commitSessionResults. */
export interface SessionCommitPayload {
  sessionId: Id;
  sportId: SportId;
  playedAt: Millis;
  perPlayer: Array<{
    playerId: Id;
    result: PlayerSessionResultDoc;
    statsPatch: Partial<PlayerSportStatsDoc>;
    rpEvent: Omit<RpEventDoc, 'id' | 'schemaVersion'>;
    summaryPatch: PlayerSportSummary;
  }>;
}
