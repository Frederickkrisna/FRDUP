/** Public leaderboard board DTO. Mirrors docs/api_contract.md §4.11 (to be added). */

import type { Id, Millis } from './common';
import type { SportId } from './sport';
import type { TierKey } from './rank';

/** One player's standing in the published snapshot. */
export interface BoardEntry {
  playerId: Id;
  name: string;
  nickname: string | null;
  avatarColor: string;
  rank: number;
  matchesPlayed: number;
  wins: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  winRate: number;
  rpDelta: number;
  tierAfter: TierKey;
  divisionAfter: number;
}

/**
 * Top-level document written by the host at session finish.
 * Readable by anyone holding the boardId; no auth required.
 * Collection: public_boards/{boardId}
 */
export interface PublicBoardDoc {
  id: Id;
  hostId: Id;
  sessionId: Id;
  sportId: SportId;
  title: string | null;
  venue: string | null;
  playedAt: Millis;
  entries: BoardEntry[];
  /** Firestore Timestamp on the wire; epoch millis in domain. */
  createdAt: Millis;
  /** 30 days after createdAt. Rule enforces unreadable after this. */
  expiresAt: Millis;
}
