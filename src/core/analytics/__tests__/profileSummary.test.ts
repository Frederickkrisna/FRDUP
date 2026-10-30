import { describe, it, expect } from 'vitest';
import { profileSummary, hasEnoughData, MIN_SESSIONS_FOR_CHARTS } from '../profileSummary';
import { makeResult, makeStats } from './fixtures';

describe('profileSummary', () => {
  it('returns all zeros for null stats', () => {
    expect(profileSummary(null)).toEqual({
      matches: 0,
      wins: 0,
      winRatePct: 0,
      sessions: 0,
      peakRp: 0,
      longestStreak: 0,
    });
  });

  it('computes win rate as an integer percentage', () => {
    const summary = profileSummary(makeStats({ matchesPlayed: 40, wins: 30 }));
    expect(summary.winRatePct).toBe(75);
  });

  it('guards matchesPlayed === 0 (no NaN)', () => {
    const summary = profileSummary(makeStats({ matchesPlayed: 0, wins: 0 }));
    expect(summary.winRatePct).toBe(0);
  });

  it('passes through sessions, peak RP, and longest streak', () => {
    const summary = profileSummary(
      makeStats({ sessionsPlayed: 12, peakRp: 2450, longestStreak: 7 }),
    );
    expect(summary.sessions).toBe(12);
    expect(summary.peakRp).toBe(2450);
    expect(summary.longestStreak).toBe(7);
  });

  it('floors negative values to zero', () => {
    const summary = profileSummary(makeStats({ matchesPlayed: -5, wins: -2, peakRp: -1 }));
    expect(summary.matches).toBe(0);
    expect(summary.wins).toBe(0);
    expect(summary.peakRp).toBe(0);
  });
});

describe('hasEnoughData', () => {
  it('is false for empty input', () => {
    expect(hasEnoughData([])).toBe(false);
  });

  it('is false below the default minimum', () => {
    const results = [makeResult({ id: 'r1' }), makeResult({ id: 'r2' })];
    expect(hasEnoughData(results)).toBe(false);
  });

  it('is true at the default minimum', () => {
    const results = Array.from({ length: MIN_SESSIONS_FOR_CHARTS }, (_, i) =>
      makeResult({ id: `r${i}` }),
    );
    expect(hasEnoughData(results)).toBe(true);
  });

  it('respects a custom minimum', () => {
    expect(hasEnoughData([makeResult()], 1)).toBe(true);
  });
});
