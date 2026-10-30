/**
 * Padel plugin — sport-specific boundary specs.
 * Tests the fixed_sum snapping behaviour and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { padelPlugin } from '../padel';

const config = { fixedTotal: 21 };
const spec = padelPlugin.buildScoreInput(config);

describe('padel — fixed_sum snapping', () => {
  it('initial score starts at 0-0', () => {
    const score = padelPlugin.createInitialScore(spec);
    expect(score.points).toEqual([0, 0]);
  });

  it('setting A snaps B to fixedTotal - A', () => {
    const score = padelPlugin.createInitialScore(spec);
    const after = padelPlugin.applyScore(score, spec, { teamIndex: 0, value: 15, mode: 'set' });
    expect(after.points[0]).toBe(15);
    expect(after.points[1]).toBe(6);
    expect(after.points[0]! + after.points[1]!).toBe(21);
  });

  it('setting B snaps A', () => {
    const score = padelPlugin.createInitialScore(spec);
    const after = padelPlugin.applyScore(score, spec, { teamIndex: 1, value: 18, mode: 'set' });
    expect(after.points[1]).toBe(18);
    expect(after.points[0]).toBe(3);
  });

  it('delta mode also snaps the other side', () => {
    const score = padelPlugin.createInitialScore(spec); // [0, 21]
    const after = padelPlugin.applyScore(score, spec, { teamIndex: 0, value: 5, mode: 'delta' });
    expect(after.points[0]).toBe(5);
    expect(after.points[1]).toBe(16);
  });

  it('clamps to [0, fixedTotal]', () => {
    const score = padelPlugin.createInitialScore(spec);
    const after = padelPlugin.applyScore(score, spec, { teamIndex: 0, value: 99, mode: 'set' });
    expect(after.points[0]).toBe(21);
    expect(after.points[1]).toBe(0);
  });

  it('edge: 0 / 21 is valid', () => {
    const score = { points: [0, 21] as number[], isComplete: false, winnerTeamIndex: null };
    expect(padelPlugin.validate(score, spec).ok).toBe(true);
  });

  it('edge: 21 / 0 is valid', () => {
    const score = { points: [21, 0] as number[], isComplete: false, winnerTeamIndex: null };
    expect(padelPlugin.validate(score, spec).ok).toBe(true);
  });

  it('validates: mismatch fails', () => {
    const score = { points: [10, 10] as number[], isComplete: false, winnerTeamIndex: null };
    expect(padelPlugin.validate(score, spec).ok).toBe(false);
  });

  it('draw: 10-11 → winnerTeamIndex is the leader', () => {
    const score = { points: [10, 11] as number[], isComplete: false, winnerTeamIndex: null };
    const evaluated = padelPlugin.evaluate(score, spec);
    expect(evaluated.winnerTeamIndex).toBe(1);
  });

  it('exact draw: fixedTotal/2 on both → null winner', () => {
    // 21 is odd so true draw impossible, but test with 16-total
    const spec16 = padelPlugin.buildScoreInput({ fixedTotal: 16 });
    const score = { points: [8, 8] as number[], isComplete: false, winnerTeamIndex: null };
    const evaluated = padelPlugin.evaluate(score, spec16);
    expect(evaluated.winnerTeamIndex).toBeNull();
  });

  it('toPlayerDeltas sums correctly — winner gets the higher points', () => {
    const teams = [['A', 'B'], ['C', 'D']];
    const match = {
      id: 'm1', courtId: 'c1', status: 'completed' as const,
      teams,
      score: { points: [15, 6], isComplete: true, winnerTeamIndex: 0 },
      startedAt: null, completedAt: null, manuallyEdited: false,
    };
    const deltas = padelPlugin.toPlayerDeltas(match, spec);
    const aDeltas = deltas.filter((d) => d.teamIndex === 0);
    const bDeltas = deltas.filter((d) => d.teamIndex === 1);
    expect(aDeltas.every((d) => d.pointsFor === 15)).toBe(true);
    expect(aDeltas.every((d) => d.pointsAgainst === 6)).toBe(true);
    expect(aDeltas.every((d) => d.won)).toBe(true);
    expect(bDeltas.every((d) => d.won)).toBe(false);
  });

  it('fixedTotal 32 variant', () => {
    const spec32 = padelPlugin.buildScoreInput({ fixedTotal: 32 });
    const score = padelPlugin.createInitialScore(spec32);
    expect(score.points).toEqual([0, 0]);
    const after = padelPlugin.applyScore(score, spec32, { teamIndex: 0, value: 20, mode: 'set' });
    expect(after.points[0]).toBe(20);
    expect(after.points[1]).toBe(12);
  });
});
