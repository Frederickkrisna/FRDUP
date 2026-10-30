/**
 * Padel sport plugin — fixed_sum (Americano).
 * Setting one side snaps the other: A + B === fixedTotal always.
 * See docs/implementation_be.md §6.1.1.
 */

import type { SportPlugin, ScoreInputSpec, ValidationResult, PlayerMatchDelta } from '@/types/sport';
import type { ScoreState, CompletedMatch } from '@/types/round';

export const padelPlugin: SportPlugin = {
  /* ---- Identity ---- */
  id: 'padel',
  nameKey: 'sport.padel.name',
  icon: 'circle-dot',
  accentColor: '#2DD4BF',

  /* ---- Structure ---- */
  matchShape: { teamsPerMatch: 2, playersPerTeam: 2 },
  defaultCourtCount: 2,
  courtLabelKey: 'sport.padel.court',
  supportsFormats: ['americano', 'mexicano', 'team_fixed', 'free'],

  /* ---- Configuration ---- */
  settings: [
    {
      key: 'fixedTotal',
      labelKey: 'sport.padel.settings.fixedTotal',
      type: 'select',
      default: 21,
      options: [
        { value: 16, labelKey: 'sport.padel.settings.fixedTotalOption16' },
        { value: 21, labelKey: 'sport.padel.settings.fixedTotalOption21' },
        { value: 24, labelKey: 'sport.padel.settings.fixedTotalOption24' },
        { value: 32, labelKey: 'sport.padel.settings.fixedTotalOption32' },
      ],
    },
  ],

  buildScoreInput(config): ScoreInputSpec {
    const fixedTotal = typeof config['fixedTotal'] === 'number' ? config['fixedTotal'] : 21;
    return { type: 'fixed_sum', fixedTotal };
  },

  /* ---- Scoring engine ---- */
  createInitialScore(_spec): ScoreState {
    return { points: [0, 0], isComplete: false, winnerTeamIndex: null };
  },

  applyScore(current, spec, change): ScoreState {
    const total = spec.fixedTotal ?? 21;
    const prev = current.points[change.teamIndex] ?? 0;
    const raw = change.mode === 'delta' ? prev + change.value : change.value;
    const clamped = Math.max(0, Math.min(total, raw));

    const points = [...current.points] as [number, number];
    points[change.teamIndex] = clamped;
    // The snap: setting one side determines the other
    points[1 - change.teamIndex] = total - clamped;

    return padelPlugin.evaluate({ ...current, points }, spec);
  },

  evaluate(score, _spec): ScoreState {
    const a = score.points[0] ?? 0;
    const b = score.points[1] ?? 0;
    // A fixed-sum match is complete when the host confirms it.
    // Any split is a legal score; we just track who's winning.
    const winnerTeamIndex = a > b ? 0 : b > a ? 1 : null;
    return { ...score, winnerTeamIndex };
  },

  /* ---- Validation ---- */
  validate(score, spec): ValidationResult {
    const total = spec.fixedTotal ?? 21;
    const a = score.points[0] ?? 0;
    const b = score.points[1] ?? 0;
    if (a === 0 && b === 0 && !score.isComplete) {
      return { ok: true, errors: [] };
    }
    if (a + b !== total) {
      return {
        ok: false,
        errors: [{ key: 'error.score.fixedSumMismatch', params: { total } }],
      };
    }
    if (a < 0 || b < 0) {
      return { ok: false, errors: [{ key: 'error.score.negative' }] };
    }
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
    { field: 'points', dir: 'desc' },
    { field: 'wins', dir: 'desc' },
    { field: 'pointDiff', dir: 'desc' },
  ],
};
