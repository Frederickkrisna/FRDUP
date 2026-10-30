/** Pingpong plugin — boundary specs. Unlimited deuce, no hard cap. */

import { describe, it, expect } from 'vitest';
import { pingpongPlugin } from '../pingpong';

describe('pingpong — unlimited deuce', () => {
  const spec = pingpongPlugin.buildScoreInput({ targetScore: 11 });

  it('wins at 11-9', () => {
    const score = { points: [11, 9], isComplete: false, winnerTeamIndex: null };
    const r = pingpongPlugin.evaluate(score, spec);
    expect(r.isComplete).toBe(true);
    expect(r.winnerTeamIndex).toBe(0);
  });

  it('deuce at 10-10', () => {
    const score = { points: [10, 10], isComplete: false, winnerTeamIndex: null };
    const r = pingpongPlugin.evaluate(score, spec);
    expect(r.isComplete).toBe(false);
  });

  it('deuce extends indefinitely: 20-19 not complete', () => {
    const score = { points: [20, 19], isComplete: false, winnerTeamIndex: null };
    const r = pingpongPlugin.evaluate(score, spec);
    expect(r.isComplete).toBe(false);
  });

  it('deuce: 20-18 → win', () => {
    const score = { points: [20, 18], isComplete: false, winnerTeamIndex: null };
    const r = pingpongPlugin.evaluate(score, spec);
    expect(r.isComplete).toBe(true);
  });

  it('no hard cap — 50-48 should still be valid ongoing', () => {
    const score = { points: [50, 49], isComplete: false, winnerTeamIndex: null };
    const r = pingpongPlugin.validate(score, spec);
    expect(r.ok).toBe(true);
  });

  it('target 21 variant', () => {
    const spec21 = pingpongPlugin.buildScoreInput({ targetScore: 21 });
    const score = { points: [21, 19], isComplete: false, winnerTeamIndex: null };
    const r = pingpongPlugin.evaluate(score, spec21);
    expect(r.isComplete).toBe(true);
  });
});
