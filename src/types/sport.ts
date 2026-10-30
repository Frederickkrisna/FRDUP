/** Sport & session primitives + SportPlugin contract. Mirrors docs/api_contract.md §2–3. */

import type { Id } from './common';

export type SportId = 'padel' | 'badminton' | 'pingpong' | 'billiard' | 'mahjong';

/** How the score pad behaves. Drives which ScorePad component renders. */
export type ScoreInputType =
  | 'fixed_sum'        // Americano: A + B always equals a constant
  | 'race_to_n'        // First to N, optional deuce / hard cap
  | 'simple_increment'; // Free +/- tally, no automatic completion

export type SessionFormat =
  | 'americano'   // rotating partners, individual scoring
  | 'mexicano'    // rotating partners chosen by live standings
  | 'team_fixed'  // fixed teams all session
  | 'free';       // host pairs everything manually

export type SessionStatus = 'setup' | 'live' | 'paused' | 'finished' | 'abandoned';
export type MatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'voided';

/** A match is generic over "teams of players" — doubles, singles, or free-for-all. */
export interface MatchShape {
  /** Number of sides in a match. Padel/Badminton/Pingpong/Billiard = 2. Mahjong = 4. */
  teamsPerMatch: number;
  /** Players on each side. Doubles = 2, singles = 1, Mahjong = 1. */
  playersPerTeam: number;
}

export interface ScoreInputSpec {
  type: ScoreInputType;

  /** fixed_sum only: A + B must equal this. */
  fixedTotal?: number;

  /** race_to_n only */
  targetScore?: number;
  deuceEnabled?: boolean;
  hardCap?: number;

  /** simple_increment only */
  step?: number;
  allowNegative?: boolean;
  maxPoints?: number | null;
}

/** User-tunable settings surfaced in Settings → Sports and session setup. */
export interface SportSettingDef {
  key: string;
  labelKey: string;
  type: 'number' | 'boolean' | 'select';
  default: number | boolean | string;
  options?: Array<{ value: number | string; labelKey: string }>;
  min?: number;
  max?: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: Array<{ key: string; params?: Record<string, string | number> }>;
}

import type { ScoreState, CompletedMatch } from './round';

export interface PlayerMatchDelta {
  playerId: Id;
  teamIndex: number;
  pointsFor: number;
  pointsAgainst: number;
  won: boolean;
  drew: boolean;
}

/**
 * The extension contract for a sport plugin.
 * Adding a sport = implement this interface in src/core/sports/<id>.ts + one line in registry.ts.
 * No other file may be touched — that is the acceptance test. See docs/api_contract.md §3.
 */
export interface SportPlugin {
  /* ---- Identity ---- */
  id: SportId;
  nameKey: string;
  icon: string;
  accentColor: string;

  /* ---- Structure ---- */
  matchShape: MatchShape;
  defaultCourtCount: number;
  courtLabelKey: string;
  supportsFormats: SessionFormat[];

  /* ---- Configuration ---- */
  settings: SportSettingDef[];
  buildScoreInput(config: Record<string, number | boolean | string>): ScoreInputSpec;

  /* ---- Scoring engine (pure) ---- */
  createInitialScore(spec: ScoreInputSpec): ScoreState;
  applyScore(
    current: ScoreState,
    spec: ScoreInputSpec,
    change: { teamIndex: number; value: number; mode: 'set' | 'delta' },
  ): ScoreState;
  evaluate(score: ScoreState, spec: ScoreInputSpec): ScoreState;

  /* ---- Validation ---- */
  validate(score: ScoreState, spec: ScoreInputSpec): ValidationResult;

  /* ---- Standings contribution ---- */
  toPlayerDeltas(match: CompletedMatch, spec: ScoreInputSpec): PlayerMatchDelta[];

  standingsSort: Array<{
    field: 'points' | 'wins' | 'pointDiff' | 'winRate' | 'matchesPlayed';
    dir: 'asc' | 'desc';
  }>;
}
