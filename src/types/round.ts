/** Round and Match DTOs. Mirrors docs/api_contract.md §4.6. */

import type { Id, Millis } from './common';
import type { MatchStatus } from './sport';

export interface ScoreState {
  /** Points per team, index-aligned with Match.teams. */
  points: number[];
  /** Optional per-team sub-counters (games, racks, rounds won). Sport-defined. */
  units?: number[];
  isComplete: boolean;
  winnerTeamIndex: number | null;
}

export interface Match {
  id: Id;
  courtId: Id;
  status: MatchStatus;
  /** teams[i] = ordered player ids on side i. */
  teams: Id[][];
  score: ScoreState;
  startedAt: Millis | null;
  completedAt: Millis | null;
  manuallyEdited: boolean;
  /** Last score/status edit. Drives field-level co-host conflict merge (api_contract.md §12, v1.1.0). */
  updatedAt?: Millis;
}

export interface CompletedMatch extends Match {
  status: 'completed';
}

export interface RoundDoc {
  id: Id;
  schemaVersion: number;
  sessionId: Id;
  roundNumber: number;
  status: 'scheduled' | 'in_progress' | 'completed';
  matches: Match[];
  restingPlayerIds: Id[];
  generatedBy: 'auto' | 'manual' | 'mexicano';
  /** PRNG seed used — allows exact reproduction for debugging. */
  seed: number;
  startedAt: Millis | null;
  completedAt: Millis | null;
  createdAt: Millis;
  updatedAt: Millis;
  /** Last writer uid for co-host conflict resolution. */
  lastWriterUid: string;
  /** Monotonic, incremented on every write — used for compare-and-set. */
  revision: number;
}
