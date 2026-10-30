import { describe, it, expect } from 'vitest';
import { winRateSeries } from '../winRateSeries';
import { makeResult } from './fixtures';

describe('winRateSeries', () => {
  it('returns an empty array for empty input', () => {
    expect(winRateSeries([], 10)).toEqual([]);
  });

  it('handles a single session', () => {
    const series = winRateSeries([makeResult({ matchesPlayed: 4, wins: 3 })], 10);
    expect(series).toHaveLength(1);
    expect(series[0]?.winRate).toBeCloseTo(0.75);
    expect(series[0]?.cumulativeWinRate).toBeCloseTo(0.75);
  });

  it('sorts newest-first input ascending by playedAt', () => {
    const newest = makeResult({ id: 'r3', sessionId: 's3', playedAt: 3000, wins: 1, matchesPlayed: 4 });
    const middle = makeResult({ id: 'r2', sessionId: 's2', playedAt: 2000, wins: 2, matchesPlayed: 4 });
    const oldest = makeResult({ id: 'r1', sessionId: 's1', playedAt: 1000, wins: 3, matchesPlayed: 4 });
    const series = winRateSeries([newest, middle, oldest], 10);
    expect(series.map((p) => p.playedAt)).toEqual([1000, 2000, 3000]);
    expect(series.map((p) => p.sessionId)).toEqual(['s1', 's2', 's3']);
  });

  it('keeps only the most recent `window` sessions', () => {
    const results = Array.from({ length: 12 }, (_, i) =>
      makeResult({ id: `r${i}`, sessionId: `s${i}`, playedAt: 1000 + i * 100, wins: 2, matchesPlayed: 4 }),
    );
    const series = winRateSeries(results, 5);
    expect(series).toHaveLength(5);
    // The 5 most recent are s7..s11.
    expect(series.map((p) => p.sessionId)).toEqual(['s7', 's8', 's9', 's10', 's11']);
  });

  it('returns all data when window is larger than the data', () => {
    const results = [
      makeResult({ id: 'r1', sessionId: 's1', playedAt: 1000 }),
      makeResult({ id: 'r2', sessionId: 's2', playedAt: 2000 }),
    ];
    expect(winRateSeries(results, 20)).toHaveLength(2);
  });

  it('guards zero matches to a 0 win rate (no NaN)', () => {
    const series = winRateSeries([makeResult({ matchesPlayed: 0, wins: 0 })], 10);
    expect(series[0]?.winRate).toBe(0);
    expect(series[0]?.cumulativeWinRate).toBe(0);
    expect(Number.isNaN(series[0]?.winRate ?? NaN)).toBe(false);
  });

  it('computes a running cumulative win rate across the window', () => {
    const results = [
      makeResult({ id: 'r1', sessionId: 's1', playedAt: 1000, wins: 2, matchesPlayed: 4 }),
      makeResult({ id: 'r2', sessionId: 's2', playedAt: 2000, wins: 4, matchesPlayed: 4 }),
    ];
    const series = winRateSeries(results, 10);
    expect(series[0]?.cumulativeWinRate).toBeCloseTo(2 / 4);
    expect(series[1]?.cumulativeWinRate).toBeCloseTo((2 + 4) / (4 + 4));
  });

  it('breaks duplicate timestamps deterministically by sessionId', () => {
    const a = makeResult({ id: 'ra', sessionId: 'b-session', playedAt: 5000 });
    const b = makeResult({ id: 'rb', sessionId: 'a-session', playedAt: 5000 });
    const series = winRateSeries([a, b], 10);
    expect(series.map((p) => p.sessionId)).toEqual(['a-session', 'b-session']);
  });
});
