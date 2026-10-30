/**
 * Billiard sport plugin — simple_increment with negative allowed (fouls).
 * Never auto-completes: host confirms the match manually.
 * See docs/implementation_be.md §6.1.4.
 */

import type { SportPlugin, ScoreInputSpec, ValidationResult, PlayerMatchDelta } from '@/types/sport';
import type { ScoreState, CompletedMatch } from '@/types/round';

export const billiardPlugin: SportPlugin = {
  /* ---- Identity ---- */
  id: 'billiard',
  nameKey: 'sport.billiard.name',
  icon: 'target',
  accentColor: '#4ADE80',

  /* ---- Structure ---- */
  matchShape: { teamsPerMatch: 2, playersPerTeam: 1 },
  defaultCourtCount: 1,
  courtLabelKey: 'sport.billiard.court',
  supportsFormats: ['americano', 'mexicano', 'team_fixed', 'free'],

  /* ---- Configuration ---- */
  settings: [
    {
      key: 'doublesMode',
      labelKey: 'sport.billiard.settings.doublesMode',
      type: 'boolean',
      default: false,
    },
  ],

  buildScoreInput(_config): ScoreInputSpec {
    return {
      type: 'simple_increment',
      step: 1,
      allowNegative: true,
      maxPoints: null,
    };
  },

  /* ---- Scoring engine ---- */
  createInitialScore(_spec): ScoreState {
    return { points: [0, 0], isComplete: false, winnerTeamIndex: null };
  },

  applyScore(current, spec, change): ScoreState {
    const points = [...current.points];
    const prev = points[change.teamIndex] ?? 0;
    const next = change.mode === 'delta' ? prev + change.value : change.value;
    const floor = spec.allowNegative ? -Infinity : 0;
    const ceil = spec.maxPoints ?? Infinity;
    points[change.teamIndex] = Math.max(floor, Math.min(ceil, next));
    return billiardPlugin.evaluate({ ...current, points }, spec);
  },

  evaluate(score, _spec): ScoreState {
    // Never auto-completes — host confirms manually
    const a = score.points[0] ?? 0;
    const b = score.points[1] ?? 0;
    const winnerTeamIndex = a > b ? 0 : b > a ? 1 : null;
    return { ...score, isComplete: score.isComplete, winnerTeamIndex };
  },

  /* ---- Validation ---- */
  validate(_score, _spec): ValidationResult {
    // Simple increment: always valid while in progress
    return { ok: true, errors: [] };
  },

  /* ---- Standings ---- */
  toPlayerDeltas(match: CompletedMatch, _spec: ScoreInputSpec): PlayerMatchDelta[] {
    const a = match.score.points[0] ?? 0;
    const b = match.score.points[1] ?? 0;
    const winner = match.score.winnerTeamIndex;

    return match.teams.flatMap((team, teamIndex) =>
      team.map((playerId) => ({
        playerId,
        teamIndex,
        pointsFor: teamIndex === 0 ? a : b,
        pointsAgainst: teamIndex === 0 ? b : a,
        won: winner === teamIndex,
        drew: winner === null,
      })),
    );
  },

  standingsSort: [
    { field: 'wins', dir: 'desc' },
    { field: 'pointDiff', dir: 'desc' },
  ],
};
