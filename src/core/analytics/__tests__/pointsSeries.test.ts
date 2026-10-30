import { describe, it, expect } from 'vitest';
import { pointsSeries } from '../pointsSeries';
import { makeResult } from './fixtures';

describe('pointsSeries', () => {
  it('returns an empty array for empty input', () => {
    expect(pointsSeries([], 10)).toEqual([]);
  });

  it('computes per-match averages', () => {
    const series = pointsSeries(
      [makeResult({ matchesPlayed: 4, pointsFor: 100, pointsAgainst: 80 })],
      10,
    );
    expect(series[0]?.perMatchFor).toBe(25);
    expect(series[0]?.perMatchAgainst).toBe(20);
  });

  it('guards matchesPlayed === 0 (no division by zero)', () => {
    const series = pointsSeries(
      [makeResult({ matchesPlayed: 0, pointsFor: 0, pointsAgainst: 0 })],
      10,
    );
    expect(series[0]?.perMatchFor).toBe(0);
    expect(series[0]?.perMatchAgainst).toBe(0);
    expect(Number.isFinite(series[0]?.perMatchFor ?? NaN)).toBe(true);
  });

  it('sorts unsorted input ascending', () => {
    const results = [
      makeResult({ id: 'r2', sessionId: 's2', playedAt: 2000 }),
      makeResult({ id: 'r1', sessionId: 's1', playedAt: 1000 }),
    ];
    const series = pointsSeries(results, 10);
    expect(series.map((p) => p.playedAt)).toEqual([1000, 2000]);
  });

  it('respects the window size', () => {
    const results = Array.from({ length: 8 }, (_, i) =>
      makeResult({ id: `r${i}`, sessionId: `s${i}`, playedAt: 1000 + i * 100 }),
    );
    expect(pointsSeries(results, 5)).toHaveLength(5);
  });

  it('rounds per-match averages to one decimal', () => {
    const series = pointsSeries(
      [makeResult({ matchesPlayed: 3, pointsFor: 100, pointsAgainst: 50 })],
      10,
    );
    expect(series[0]?.perMatchFor).toBe(33.3);
    expect(series[0]?.perMatchAgainst).toBe(16.7);
  });
});
