/**
 * Mahjong sport plugin — 4-way simple_increment.
 * Each "team" is one player (+1 per round won). No teams, no deuce, no cap.
 * See docs/implementation_be.md §6.1.5.
 */

import type { SportPlugin, ScoreInputSpec, ValidationResult, PlayerMatchDelta } from '@/types/sport';
import type { ScoreState, CompletedMatch } from '@/types/round';


export const mahjongPlugin: SportPlugin = {
  /* ---- Identity ---- */
  id: 'mahjong',
  nameKey: 'sport.mahjong.name',
  icon: 'grid-3x3',
  accentColor: '#F87171',

  /* ---- Structure ---- */
  matchShape: { teamsPerMatch: 4, playersPerTeam: 1 },
  defaultCourtCount: 1,
  courtLabelKey: 'sport.mahjong.court',
  supportsFormats: ['americano', 'mexicano', 'free'],

  /* ---- Configuration ---- */
  settings: [],

  buildScoreInput(_config): ScoreInputSpec {
    return {
      type: 'simple_increment',
      step: 1,
      allowNegative: false,
      maxPoints: null,
    };
  },

  /* ---- Scoring engine ---- */
  createInitialScore(_spec): ScoreState {
    return { points: [0, 0, 0, 0], isComplete: false, winnerTeamIndex: null };
  },

  applyScore(current, spec, change): ScoreState {
    const points = [...current.points];
    const prev = points[change.teamIndex] ?? 0;
    const next = change.mode === 'delta' ? prev + change.value : change.value;
    points[change.teamIndex] = Math.max(0, next);
    return mahjongPlugin.evaluate({ ...current, points }, spec);
  },

  evaluate(score, _spec): ScoreState {
    // Never auto-completes — host confirms manually
    const { points } = score;
    const max = Math.max(...points);
    const winners = points.reduce<number[]>((acc, p, i) => (p === max ? [...acc, i] : acc), []);
    const winnerTeamIndex = winners.length === 1 ? (winners[0] ?? null) : null;
    return { ...score, isComplete: score.isComplete, winnerTeamIndex };
  },

  /* ---- Validation ---- */
  validate(_score, _spec): ValidationResult {
    return { ok: true, errors: [] };
  },

  /* ---- Standings ---- */
  toPlayerDeltas(match: CompletedMatch, _spec: ScoreInputSpec): PlayerMatchDelta[] {
    const { points } = match.score;
    const total = points.reduce((s, p) => s + p, 0);
    const winner = match.score.winnerTeamIndex;

    // In Mahjong each player at the table is their own "team"
    return match.teams.flatMap((team, teamIndex) =>
      team.map((playerId) => {
        const myPoints = points[teamIndex] ?? 0;
        return {
          playerId,
          teamIndex,
          pointsFor: myPoints,
          pointsAgainst: total - myPoints,
          won: winner === teamIndex,
          drew: winner === null,
        };
      }),
    );
  },

  standingsSort: [
    { field: 'points', dir: 'desc' },
    { field: 'wins', dir: 'desc' },
  ],
};
