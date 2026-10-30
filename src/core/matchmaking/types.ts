/**
 * Matchmaking domain types.
 * Mirrors docs/api_contract.md §5.2 and implementation_be.md §6.2.
 */

import type { Id } from '@/types/common';
import type { MatchShape, SessionFormat } from '@/types/sport';
import type { CourtDef } from '@/types/session';
import type { Match } from '@/types/round';

export interface HistoryMatrix {
  /** partner[i][j] = number of rounds i and j were on the SAME team. */
  partner: Record<Id, Record<Id, number>>;
  /** opponent[i][j] = number of rounds i and j were on OPPOSING teams. */
  opponent: Record<Id, Record<Id, number>>;
  restCount: Record<Id, number>;
  matchesPlayed: Record<Id, number>;
  /** Most recent round number the player sat out (0 = never). */
  lastRestedRound: Record<Id, number>;
}

export interface StandingRow {
  playerId: Id;
  rank: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  winRate: number;
  restCount: number;
}

export interface CostWeights {
  repeatPartner: number;      // default 10
  repeatOpponent: number;     // default 3
  restImbalance: number;      // default 8
  matchCountImbalance: number; // default 5
  skillImbalance: number;     // default 0 (off — social first)
}

export const DEFAULT_COST_WEIGHTS: CostWeights = {
  repeatPartner: 10,
  repeatOpponent: 3,
  restImbalance: 8,
  matchCountImbalance: 5,
  skillImbalance: 0,
};

export interface PlayerLock {
  playerId: Id;
  courtId: Id;
  teamIndex: number;
}

export interface GenerateRoundInput {
  roundNumber: number;
  eligiblePlayerIds: Id[];
  courts: CourtDef[];
  shape: MatchShape;
  history: HistoryMatrix;
  standings?: StandingRow[];
  strategy: SessionFormat;
  seed: number;
  weights?: CostWeights;
  locks?: PlayerLock[];
}

export interface GenerateRoundOutput {
  matches: Match[];
  restingPlayerIds: Id[];
  cost: number;
  iterations: number;
}
