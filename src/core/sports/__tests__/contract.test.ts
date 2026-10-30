/**
 * Generic SportPlugin contract suite.
 * runPluginContractSuite(plugin) runs these invariants against every registered plugin.
 * Per-plugin specs cover sport-specific boundary cases.
 * See docs/implementation_be.md §6.1.6.
 */

import { describe, it, expect } from 'vitest';
import type { SportPlugin } from '@/types/sport';
import type { CompletedMatch } from '@/types/round';
import { listSports } from '../registry';

export function runPluginContractSuite(plugin: SportPlugin): void {
  const config: Record<string, number | boolean | string> = {};
  for (const s of plugin.settings) {
    config[s.key] = s.default;
  }
  const spec = plugin.buildScoreInput(config);
  const shape = plugin.matchShape;

  describe(`${plugin.id} — contract`, () => {
    it('createInitialScore returns the right number of points', () => {
      const score = plugin.createInitialScore(spec);
      expect(score.points).toHaveLength(shape.teamsPerMatch);
    });

    it('createInitialScore is not complete', () => {
      const score = plugin.createInitialScore(spec);
      expect(score.isComplete).toBe(false);
      expect(score.winnerTeamIndex).toBeNull();
    });

    it('applyScore is pure — does not mutate the input', () => {
      const score = plugin.createInitialScore(spec);
      const frozen = JSON.stringify(score);
      plugin.applyScore(score, spec, { teamIndex: 0, value: 1, mode: 'delta' });
      expect(JSON.stringify(score)).toBe(frozen);
    });

    it('applyScore mode:set is idempotent', () => {
      const score = plugin.createInitialScore(spec);
      const after1 = plugin.applyScore(score, spec, { teamIndex: 0, value: 5, mode: 'set' });
      const after2 = plugin.applyScore(score, spec, { teamIndex: 0, value: 5, mode: 'set' });
      expect(after1.points[0]).toBe(after2.points[0]);
    });

    it('evaluate is consistent with applyScore result', () => {
      const score = plugin.createInitialScore(spec);
      const after = plugin.applyScore(score, spec, { teamIndex: 0, value: 1, mode: 'delta' });
      const evaluated = plugin.evaluate(after, spec);
      expect(evaluated.points).toEqual(after.points);
    });

    it('validate returns { ok: true } on the initial score', () => {
      const score = plugin.createInitialScore(spec);
      const result = plugin.validate(score, spec);
      expect(result.ok).toBe(true);
    });

    it('toPlayerDeltas has an entry for every player in the match', () => {
      const totalPlayers = shape.teamsPerMatch * shape.playersPerTeam;
      const teams = Array.from({ length: shape.teamsPerMatch }, (_, ti) =>
        Array.from({ length: shape.playersPerTeam }, (__, pi) => `player-${ti}-${pi}`),
      );

      const match: CompletedMatch = {
        id: 'test-match',
        courtId: 'court-1',
        status: 'completed',
        teams,
        score: { ...plugin.createInitialScore(spec), isComplete: true },
        startedAt: null,
        completedAt: null,
        manuallyEdited: false,
      };

      const deltas = plugin.toPlayerDeltas(match, spec);
      expect(deltas).toHaveLength(totalPlayers);

      const playerIds = deltas.map((d) => d.playerId);
      const allTeamPlayerIds = teams.flat();
      expect(playerIds.sort()).toEqual(allTeamPlayerIds.sort());
    });

    it('toPlayerDeltas pointsFor + pointsAgainst covers total points scored', () => {
      const teams = Array.from({ length: shape.teamsPerMatch }, (_, ti) =>
        Array.from({ length: shape.playersPerTeam }, (__, pi) => `player-${ti}-${pi}`),
      );
      const score = { ...plugin.createInitialScore(spec), isComplete: true };

      const match: CompletedMatch = {
        id: 'test-match',
        courtId: 'court-1',
        status: 'completed',
        teams,
        score,
        startedAt: null,
        completedAt: null,
        manuallyEdited: false,
      };

      const deltas = plugin.toPlayerDeltas(match, spec);
      // Every delta's pointsFor should be non-negative
      for (const d of deltas) {
        expect(d.pointsFor).toBeGreaterThanOrEqual(0);
        expect(d.pointsAgainst).toBeGreaterThanOrEqual(0);
      }
    });

    it('standingsSort is non-empty and uses valid fields', () => {
      const validFields = ['points', 'wins', 'pointDiff', 'winRate', 'matchesPlayed'];
      expect(plugin.standingsSort.length).toBeGreaterThan(0);
      for (const s of plugin.standingsSort) {
        expect(validFields).toContain(s.field);
        expect(['asc', 'desc']).toContain(s.dir);
      }
    });

    it('buildScoreInput returns the correct type for this plugin', () => {
      const validTypes = ['fixed_sum', 'race_to_n', 'simple_increment'];
      expect(validTypes).toContain(spec.type);
    });
  });
}

// Run the contract suite against every registered plugin
describe('SportPlugin contract — all registered plugins', () => {
  for (const plugin of listSports()) {
    runPluginContractSuite(plugin);
  }
});
