/**
 * Badminton plugin — sport-specific boundary specs.
 * Tests deuce logic, hard cap at 30, and scoring mechanics.
 */

import { describe, it, expect } from 'vitest';
import { badmintonPlugin } from '../badminton';

const spec = badmintonPlugin.buildScoreInput({ targetScore: 21 });

describe('badminton — race_to_n with deuce + cap', () => {
  it('not complete below target', () => {
    const score = { points: [20, 18], isComplete: false, winnerTeamIndex: null };
    const result = badmintonPlugin.evaluate(score, spec);
    expect(result.isComplete).toBe(false);
  });

  it('wins at 21 with 2-point margin', () => {
    const score = { points: [21, 19], isComplete: false, winnerTeamIndex: null };
    const result = badmintonPlugin.evaluate(score, spec);
    expect(result.isComplete).toBe(true);
    expect(result.winnerTeamIndex).toBe(0);
  });

  it('deuce: 20-20 not complete', () => {
    const score = { points: [20, 20], isComplete: false, winnerTeamIndex: null };
    const result = badmintonPlugin.evaluate(score, spec);
    expect(result.isComplete).toBe(false);
  });

  it('deuce: 22-20 → team 0 wins', () => {
    const score = { points: [22, 20], isComplete: false, winnerTeamIndex: null };
    const result = badmintonPlugin.evaluate(score, spec);
    expect(result.isComplete).toBe(true);
    expect(result.winnerTeamIndex).toBe(0);
  });

  it('deuce ongoing: 25-24', () => {
    const score = { points: [25, 24], isComplete: false, winnerTeamIndex: null };
    const result = badmintonPlugin.evaluate(score, spec);
    expect(result.isComplete).toBe(false);
  });

  it('hard cap at 30: 30-29 → team 0 wins regardless of margin', () => {
    const score = { points: [30, 29], isComplete: false, winnerTeamIndex: null };
    const result = badmintonPlugin.evaluate(score, spec);
    expect(result.isComplete).toBe(true);
    expect(result.winnerTeamIndex).toBe(0);
  });

  it('hard cap: 29-30 → team 1 wins', () => {
    const score = { points: [29, 30], isComplete: false, winnerTeamIndex: null };
    const result = badmintonPlugin.evaluate(score, spec);
    expect(result.isComplete).toBe(true);
    expect(result.winnerTeamIndex).toBe(1);
  });

  it('validate rejects exceeding cap', () => {
    const score = { points: [31, 0], isComplete: false, winnerTeamIndex: null };
    const result = badmintonPlugin.validate(score, spec);
    expect(result.ok).toBe(false);
  });

  it('validate rejects impossible continued play after winner', () => {
    // If 21-19 is the final score, continuing to 22-19 would be invalid
    const score = { points: [22, 19], isComplete: false, winnerTeamIndex: null };
    const result = badmintonPlugin.validate(score, spec);
    expect(result.ok).toBe(false);
  });

  it('validate accepts a legal deuce FINAL score (22-20, 30-28) and rejects 24-20', () => {
    const ok = (points: number[]) => badmintonPlugin.validate({ points, isComplete: false, winnerTeamIndex: null }, spec).ok;
    expect(ok([22, 20])).toBe(true);
    expect(ok([30, 28])).toBe(true);
    expect(ok([24, 20])).toBe(false);
  });

  it('validate accepts valid deuce score 23-22', () => {
    const score = { points: [23, 22], isComplete: false, winnerTeamIndex: null };
    const result = badmintonPlugin.validate(score, spec);
    expect(result.ok).toBe(true);
  });

  it('applyScore floors at 0', () => {
    const score = { points: [0, 0], isComplete: false, winnerTeamIndex: null };
    const after = badmintonPlugin.applyScore(score, spec, { teamIndex: 0, value: -1, mode: 'delta' });
    expect(after.points[0]).toBe(0);
  });
});
