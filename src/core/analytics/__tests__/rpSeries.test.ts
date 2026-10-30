import { describe, it, expect } from 'vitest';
import { rpSeries, tierBands } from '../rpSeries';
import { makeRpEvent } from './fixtures';

describe('rpSeries', () => {
  it('returns an empty array for empty input', () => {
    expect(rpSeries([])).toEqual([]);
  });

  it('sorts events ascending by createdAt', () => {
    const events = [
      makeRpEvent({ id: 'e2', createdAt: 2000, rpAfter: 140 }),
      makeRpEvent({ id: 'e1', createdAt: 1000, rpAfter: 120 }),
    ];
    const series = rpSeries(events);
    expect(series.map((p) => p.createdAt)).toEqual([1000, 2000]);
  });

  it('breaks duplicate timestamps deterministically by event id', () => {
    const events = [
      makeRpEvent({ id: 'e-b', createdAt: 5000 }),
      makeRpEvent({ id: 'e-a', createdAt: 5000 }),
    ];
    expect(rpSeries(events).map((p) => p.eventId)).toEqual(['e-a', 'e-b']);
  });

  it('flags session_reverted events', () => {
    const events = [
      makeRpEvent({ id: 'e1', createdAt: 1000, reason: 'session_result' }),
      makeRpEvent({ id: 'e2', createdAt: 2000, reason: 'session_reverted', delta: -20 }),
    ];
    const series = rpSeries(events);
    expect(series[0]?.reverted).toBe(false);
    expect(series[1]?.reverted).toBe(true);
    expect(series[1]?.reason).toBe('session_reverted');
  });

  it('clamps negative rpAfter to 0', () => {
    const series = rpSeries([makeRpEvent({ rpAfter: -50 })]);
    expect(series[0]?.rpAfter).toBe(0);
  });

  it('preserves a single event', () => {
    const series = rpSeries([makeRpEvent({ rpAfter: 480, tierAfter: 'elite' })]);
    expect(series).toHaveLength(1);
    expect(series[0]?.tierAfter).toBe('elite');
  });
});

describe('tierBands', () => {
  it('returns at least the lowest band for a zero ceiling', () => {
    const bands = tierBands(0);
    expect(bands).toHaveLength(1);
    expect(bands[0]?.tier).toBe('warrior');
    expect(bands[0]?.from).toBe(0);
    expect(bands[0]?.to).toBe(0);
  });

  it('includes only tiers intersecting a low ceiling', () => {
    // Warrior floor 0, Elite floor 450. A ceiling of 300 stays inside warrior.
    const bands = tierBands(300);
    expect(bands.map((b) => b.tier)).toEqual(['warrior']);
    expect(bands[0]?.from).toBe(0);
    expect(bands[0]?.to).toBe(300);
  });

  it('spans multiple tiers (Warrior → Elite → Master)', () => {
    // Master floor is 1050; a ceiling of 1200 reaches into Master.
    const bands = tierBands(1200);
    expect(bands.map((b) => b.tier)).toEqual(['warrior', 'elite', 'master']);
    const warrior = bands.find((b) => b.tier === 'warrior');
    const elite = bands.find((b) => b.tier === 'elite');
    const master = bands.find((b) => b.tier === 'master');
    expect(warrior).toEqual({ tier: 'warrior', from: 0, to: 450 });
    expect(elite).toEqual({ tier: 'elite', from: 450, to: 1050 });
    expect(master).toEqual({ tier: 'master', from: 1050, to: 1200 });
  });

  it('handles huge RP beyond the Mythic floor', () => {
    // Mythic floor is 3900. Ceiling 8000 keeps all 7 bands with Mythic extended.
    const bands = tierBands(8000);
    expect(bands.map((b) => b.tier)).toEqual([
      'warrior',
      'elite',
      'master',
      'grandmaster',
      'epic',
      'legend',
      'mythic',
    ]);
    const mythic = bands.at(-1);
    expect(mythic?.tier).toBe('mythic');
    expect(mythic?.from).toBe(3900);
    expect(mythic?.to).toBe(8000);
  });

  it('clamps a negative ceiling to zero', () => {
    const bands = tierBands(-100);
    expect(bands).toHaveLength(1);
    expect(bands[0]?.to).toBe(0);
  });
});
