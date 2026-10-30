/** Billiard plugin — boundary specs. Negatives allowed, no auto-complete. */

import { describe, it, expect } from 'vitest';
import { billiardPlugin } from '../billiard';

describe('billiard — simple_increment with negatives', () => {
  const spec = billiardPlugin.buildScoreInput({});

  it('allows negative scores (fouls)', () => {
    const score = billiardPlugin.createInitialScore(spec);
    const after = billiardPlugin.applyScore(score, spec, { teamIndex: 0, value: -3, mode: 'delta' });
    expect(after.points[0]).toBe(-3);
  });

  it('never auto-completes on applyScore', () => {
    const score = billiardPlugin.createInitialScore(spec);
    const after = billiardPlugin.applyScore(score, spec, { teamIndex: 0, value: 100, mode: 'delta' });
    expect(after.isComplete).toBe(false);
  });

  it('evaluate tracks the winning side without completing', () => {
    const score = { points: [7, 3], isComplete: false, winnerTeamIndex: null };
    const r = billiardPlugin.evaluate(score, spec);
    expect(r.winnerTeamIndex).toBe(0);
    expect(r.isComplete).toBe(false);
  });

  it('evaluate: tied → null winner', () => {
    const score = { points: [5, 5], isComplete: false, winnerTeamIndex: null };
    const r = billiardPlugin.evaluate(score, spec);
    expect(r.winnerTeamIndex).toBeNull();
  });

  it('validate always returns ok', () => {
    const score = { points: [-10, -5], isComplete: false, winnerTeamIndex: null };
    const r = billiardPlugin.validate(score, spec);
    expect(r.ok).toBe(true);
  });

  it('mode set overwrites the value', () => {
    const score = { points: [5, 3], isComplete: false, winnerTeamIndex: null };
    const after = billiardPlugin.applyScore(score, spec, { teamIndex: 0, value: 1, mode: 'set' });
    expect(after.points[0]).toBe(1);
  });

  it('toPlayerDeltas: winner has won=true, loser won=false', () => {
    const teams = [['P1'], ['P2']];
    const match = {
      id: 'm1', courtId: 'c1', status: 'completed' as const,
      teams,
      score: { points: [7, 3], isComplete: true, winnerTeamIndex: 0 },
      startedAt: null, completedAt: null, manuallyEdited: false,
    };
    const deltas = billiardPlugin.toPlayerDeltas(match, spec);
    expect(deltas.find((d) => d.playerId === 'P1')?.won).toBe(true);
    expect(deltas.find((d) => d.playerId === 'P2')?.won).toBe(false);
  });
});
