/** Mahjong plugin — boundary specs. 4-way simple_increment, no auto-complete. */

import { describe, it, expect } from 'vitest';
import { mahjongPlugin } from '../mahjong';

describe('mahjong — 4-way simple_increment', () => {
  const spec = mahjongPlugin.buildScoreInput({});

  it('initial score has 4 points slots', () => {
    const score = mahjongPlugin.createInitialScore(spec);
    expect(score.points).toHaveLength(4);
    expect(score.points.every((p) => p === 0)).toBe(true);
  });

  it('does not allow negative (allowNegative: false)', () => {
    const score = mahjongPlugin.createInitialScore(spec);
    const after = mahjongPlugin.applyScore(score, spec, { teamIndex: 0, value: -1, mode: 'delta' });
    expect(after.points[0]).toBe(0);
  });

  it('each player accumulates independently', () => {
    let score = mahjongPlugin.createInitialScore(spec);
    score = mahjongPlugin.applyScore(score, spec, { teamIndex: 0, value: 3, mode: 'set' });
    score = mahjongPlugin.applyScore(score, spec, { teamIndex: 2, value: 1, mode: 'set' });
    expect(score.points[0]).toBe(3);
    expect(score.points[1]).toBe(0);
    expect(score.points[2]).toBe(1);
    expect(score.points[3]).toBe(0);
  });

  it('never auto-completes', () => {
    const score = { points: [10, 0, 0, 0], isComplete: false, winnerTeamIndex: null };
    const r = mahjongPlugin.evaluate(score, spec);
    expect(r.isComplete).toBe(false);
  });

  it('evaluate: clear winner tracked', () => {
    const score = { points: [5, 3, 2, 1], isComplete: false, winnerTeamIndex: null };
    const r = mahjongPlugin.evaluate(score, spec);
    expect(r.winnerTeamIndex).toBe(0);
  });

  it('evaluate: tie → null winner', () => {
    const score = { points: [5, 5, 3, 3], isComplete: false, winnerTeamIndex: null };
    const r = mahjongPlugin.evaluate(score, spec);
    expect(r.winnerTeamIndex).toBeNull();
  });

  it('toPlayerDeltas: 4 entries for 4 players', () => {
    const teams = [['P0'], ['P1'], ['P2'], ['P3']];
    const match = {
      id: 'm1', courtId: 't1', status: 'completed' as const,
      teams,
      score: { points: [5, 3, 2, 1], isComplete: true, winnerTeamIndex: 0 },
      startedAt: null, completedAt: null, manuallyEdited: false,
    };
    const deltas = mahjongPlugin.toPlayerDeltas(match, spec);
    expect(deltas).toHaveLength(4);
    expect(deltas.find((d) => d.playerId === 'P0')?.won).toBe(true);
    expect(deltas.find((d) => d.playerId === 'P1')?.won).toBe(false);
  });

  it('toPlayerDeltas: pointsAgainst = total - pointsFor', () => {
    const teams = [['P0'], ['P1'], ['P2'], ['P3']];
    const pts = [5, 3, 2, 1];
    const total = 11;
    const match = {
      id: 'm1', courtId: 't1', status: 'completed' as const,
      teams,
      score: { points: pts, isComplete: true, winnerTeamIndex: 0 },
      startedAt: null, completedAt: null, manuallyEdited: false,
    };
    const deltas = mahjongPlugin.toPlayerDeltas(match, spec);
    for (const d of deltas) {
      expect(d.pointsFor + d.pointsAgainst).toBe(total);
    }
  });
});
