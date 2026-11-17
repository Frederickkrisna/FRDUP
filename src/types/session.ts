/** Session document DTOs. Mirrors docs/api_contract.md §4.5. */

import type { Id, Millis } from './common';
import type { SportId, SessionFormat, SessionStatus, ScoreInputSpec } from './sport';

export interface CourtDef {
  id: Id;
  /** 0-based display order. */
  index: number;
  label: string;
  isActive: boolean;
}

export interface SessionParticipant {
  playerId: Id;
  name: string;
  nickname: string | null;
  avatarUrl?: string | null;
  avatarColor: string;
  isGuest: boolean;
  joinedAtRound: number;
  leftAtRound: number | null;
  includeInRanking: boolean;
  includeInBill: boolean;
}

export interface SessionDoc {
  id: Id;
  schemaVersion: number;
  hostId: Id;
  hostAnonUid: string;
  sportId: SportId;
  format: SessionFormat;
  status: SessionStatus;
  title: string | null;
  venue: string | null;
  playedAt: Millis;
  /** Resolved sport settings for this session. */
  sportConfig: Record<string, number | boolean | string>;
  /** Materialised so co-hosts need no plugin resolution. */
  scoreInput: ScoreInputSpec;
  courts: CourtDef[];
  targetRounds: number | null;
  plannedEndAt: Millis | null;
  /** Private leaderboard: standings stay covered on every device until the host reveals them. Absent = shown. */
  standingsHidden?: boolean;
  participants: SessionParticipant[];
  currentRoundNumber: number;
  completedRoundCount: number;
  joinCode: string | null;
  joinCodeExpiresAt: Millis | null;
  coHostCount: number;
  rankingApplied: boolean;
  billId: Id | null;
  createdAt: Millis;
  updatedAt: Millis;
  finishedAt: Millis | null;
}

/** Input for sessionStore.startSession / sessionRepo.create. */
export interface NewSessionInput {
  hostId: Id;
  hostAnonUid: string;
  sportId: SportId;
  format: SessionFormat;
  title?: string | null;
  venue?: string | null;
  courts: Array<{ label: string }>;
  targetRounds?: number | null;
  plannedEndAt?: Millis | null;
  sportConfig: Record<string, number | boolean | string>;
  scoreInput: ScoreInputSpec;
  participants: SessionParticipant[];
}
