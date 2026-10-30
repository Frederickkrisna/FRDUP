/**
 * Shared race-to-N scoring engine.
 * Used by Badminton and Pingpong — different config, same logic.
 * This is the proof the plugin abstraction is real: zero branching on sportId.
 * See docs/implementation_be.md §6.1.2–6.1.3.
 */

import type { ScoreState, CompletedMatch } from '@/types/round';
import type { ScoreInputSpec, ValidationResult, PlayerMatchDelta } from '@/types/sport';
import type { Id } from '@/types/common';

/** Two-sided points as a typed tuple (missing entries read as 0). */
function pair(score: ScoreState): [number, number] {
  return [score.points[0] ?? 0, score.points[1] ?? 0];
}

/** Apply a +1/-1 delta or absolute set to one side. Floor at 0. */
export function raceToNApplyScore(
  current: ScoreState,
  spec: ScoreInputSpec,
  change: { teamIndex: number; value: number; mode: 'set' | 'delta' },
): ScoreState {
  const points = [...current.points];
  const prev = points[change.teamIndex] ?? 0;
  const next =
    change.mode === 'delta' ? prev + change.value : change.value;
  points[change.teamIndex] = Math.max(0, next);
  return raceToNEvaluate({ ...current, points }, spec);
}

/** Recompute isComplete and winnerTeamIndex from raw points. */
export function raceToNEvaluate(score: ScoreState, spec: ScoreInputSpec): ScoreState {
  const { targetScore = 21, deuceEnabled = true, hardCap } = spec;
  const [a, b] = pair(score);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  let winnerTeamIndex: number | null = null;

  if (hardCap != null && hi >= hardCap) {
    // First to reach the hard cap wins regardless of margin
    winnerTeamIndex = a >= b ? 0 : 1;
  } else if (hi >= targetScore) {
    if (!deuceEnabled || hi - lo >= 2) {
      winnerTeamIndex = a > b ? 0 : b > a ? 1 : null;
    }
    // else: deuce active, margin < 2 — not yet decided
  }

  return {
    ...score,
    isComplete: winnerTeamIndex !== null,
    winnerTeamIndex,
  };
}

/** Validate a race-to-N score. Rejects impossible states after a winner could have been declared. */
export function raceToNValidate(score: ScoreState, spec: ScoreInputSpec): ValidationResult {
  const { targetScore = 21, deuceEnabled = true, hardCap } = spec;
  const [a, b] = pair(score);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);

  // Both non-negative
  if (a < 0 || b < 0) {
    return { ok: false, errors: [{ key: 'error.score.negative' }] };
  }

  // Hard cap: neither side may exceed it (the match would have ended)
  if (hardCap != null && hi > hardCap) {
    return { ok: false, errors: [{ key: 'error.score.exceedsCap', params: { cap: hardCap } }] };
  }

  // Once a winner is possible, the trailing side can't keep scoring
  if (hi > targetScore) {
    if (!deuceEnabled) {
      return { ok: false, errors: [{ key: 'error.score.exceedsTarget', params: { target: targetScore } }] };
    }
    // Deuce: past the target the only legal states are ongoing (margin 0/1) or the final score
    // (margin exactly 2, e.g. 22-20). A margin of 3+ means play should have stopped earlier.
    if (hi - lo > 2) {
      return { ok: false, errors: [{ key: 'error.score.matchAlreadyDecided' }] };
    }
  }

  return { ok: true, errors: [] };
}

/** Convert a completed match to per-player deltas. Used for standings. */
export function raceToNPlayerDeltas(match: CompletedMatch, playerIds: Id[][]): PlayerMatchDelta[] {
  const [a, b] = pair(match.score);
  const winner = match.score.winnerTeamIndex;

  return playerIds.flatMap((team, teamIndex) =>
    team.map((playerId) => ({
      playerId,
      teamIndex,
      pointsFor: teamIndex === 0 ? a : b,
      pointsAgainst: teamIndex === 0 ? b : a,
      won: winner === teamIndex,
      drew: winner === null,
    })),
  );
}
