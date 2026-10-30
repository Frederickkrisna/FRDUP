/**
 * Badminton sport plugin — race_to_n with deuce and hard cap at 30.
 * Delegates to the shared raceToN engine.
 * See docs/implementation_be.md §6.1.2.
 */

import type { SportPlugin, ScoreInputSpec } from '@/types/sport';
import type { ScoreState, CompletedMatch } from '@/types/round';
import {
  raceToNApplyScore,
  raceToNEvaluate,
  raceToNValidate,
  raceToNPlayerDeltas,
} from './shared/raceToN';

export const badmintonPlugin: SportPlugin = {
  /* ---- Identity ---- */
  id: 'badminton',
  nameKey: 'sport.badminton.name',
  icon: 'feather',
  accentColor: '#60A5FA',

  /* ---- Structure ---- */
  matchShape: { teamsPerMatch: 2, playersPerTeam: 2 },
  defaultCourtCount: 2,
  courtLabelKey: 'sport.badminton.court',
  supportsFormats: ['americano', 'mexicano', 'team_fixed', 'free'],

  /* ---- Configuration ---- */
  settings: [
    {
      key: 'targetScore',
      labelKey: 'sport.badminton.settings.targetScore',
      type: 'number',
      default: 21,
      min: 11,
      max: 30,
    },
    {
      key: 'singleMode',
      labelKey: 'sport.badminton.settings.singleMode',
      type: 'boolean',
      default: false,
    },
  ],

  buildScoreInput(config): ScoreInputSpec {
    const targetScore = typeof config['targetScore'] === 'number' ? config['targetScore'] : 21;
    return {
      type: 'race_to_n',
      targetScore,
      deuceEnabled: true,
      hardCap: 30,
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
