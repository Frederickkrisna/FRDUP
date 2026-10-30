/**
 * Pingpong / Table Tennis sport plugin — race_to_n, unlimited deuce, no hard cap.
 * Delegates to the shared raceToN engine.
 * See docs/implementation_be.md §6.1.3.
 */

import type { SportPlugin, ScoreInputSpec } from '@/types/sport';
import type { ScoreState, CompletedMatch } from '@/types/round';
import {
  raceToNApplyScore,
  raceToNEvaluate,
  raceToNValidate,
  raceToNPlayerDeltas,
} from './shared/raceToN';

export const pingpongPlugin: SportPlugin = {
  /* ---- Identity ---- */
  id: 'pingpong',
  nameKey: 'sport.pingpong.name',
  icon: 'circle',
  accentColor: '#FB923C',

  /* ---- Structure ---- */
  matchShape: { teamsPerMatch: 2, playersPerTeam: 1 },
  defaultCourtCount: 1,
  courtLabelKey: 'sport.pingpong.court',
  supportsFormats: ['americano', 'mexicano', 'team_fixed', 'free'],

  /* ---- Configuration ---- */
  settings: [
    {
      key: 'targetScore',
      labelKey: 'sport.pingpong.settings.targetScore',
      type: 'select',
      default: 11,
      options: [
        { value: 11, labelKey: 'sport.pingpong.settings.target11' },
        { value: 15, labelKey: 'sport.pingpong.settings.target15' },
        { value: 21, labelKey: 'sport.pingpong.settings.target21' },
      ],
    },
    {
      key: 'doublesMode',
      labelKey: 'sport.pingpong.settings.doublesMode',
      type: 'boolean',
      default: false,
    },
  ],

  buildScoreInput(config): ScoreInputSpec {
    const targetScore = typeof config['targetScore'] === 'number' ? config['targetScore'] : 11;
    return {
      type: 'race_to_n',
      targetScore,
      deuceEnabled: true,
      hardCap: undefined, // unlimited deuce
    };
  },

  /* ---- Scoring engine ---- */
  createInitialScore(_spec): ScoreState {
    return { points: [0, 0], isComplete: false, winnerTeamIndex: null };
  },

  applyScore(current, spec, change): ScoreState {
    return raceToNApplyScore(current, spec, change);
  },

  evaluate(score, spec): ScoreState {
    return raceToNEvaluate(score, spec);
  },

  /* ---- Validation ---- */
  validate(score, spec) {
    return raceToNValidate(score, spec);
  },

  /* ---- Standings ---- */
  toPlayerDeltas(match: CompletedMatch, _spec: ScoreInputSpec) {
    return raceToNPlayerDeltas(match, match.teams);
  },

  standingsSort: [
    { field: 'wins', dir: 'desc' },
    { field: 'pointDiff', dir: 'desc' },
    { field: 'points', dir: 'desc' },
  ],
};
