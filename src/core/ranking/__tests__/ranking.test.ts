/**
 * Ranking system tests — ladder, computeSessionRp, applyRp.
 * Table-driven tests at every tier/division boundary.
 * See docs/implementation_be.md §6.3.
 */

import { describe, it, expect } from 'vitest';
import { rpToPosition, computeSessionRp, applyRp } from '../computeRp';
import { TIER_LADDER } from '../ladder';

describe('rpToPosition — tier boundaries', () => {
  it('rp=0 → Warrior III, 0 stars', () => {
    const pos = rpToPosition(0);
    expect(pos.tier).toBe('warrior');
    expect(pos.division).toBe(3);
    expect(pos.stars).toBe(0);
  });

  it('rp=449 → still Warrior', () => {
    const pos = rpToPosition(449);
    expect(pos.tier).toBe('warrior');
  });

  it('rp=450 → Elite IV, 0 stars', () => {
    const pos = rpToPosition(450);
    expect(pos.tier).toBe('elite');
    expect(pos.division).toBe(4);
    expect(pos.stars).toBe(0);
  });

  it('rp=500 → Elite IV, 1 star', () => {
    const pos = rpToPosition(500);
    expect(pos.tier).toBe('elite');
    expect(pos.division).toBe(4);
    expect(pos.stars).toBe(1);
  });

  it('rp=1049 → still Master boundary - 1', () => {
    const pos = rpToPosition(1049);
    expect(pos.tier).toBe('elite');
  });

  it('rp=1050 → Master IV, 0 stars', () => {
    const pos = rpToPosition(1050);
    expect(pos.tier).toBe('master');
    expect(pos.division).toBe(4);
    expect(pos.stars).toBe(0);
  });

  it('rp=1650 → Grandmaster V, 0 stars', () => {
    const pos = rpToPosition(1650);
    expect(pos.tier).toBe('grandmaster');
    expect(pos.division).toBe(5);
    expect(pos.stars).toBe(0);
  });

  it('rp=2400 → Epic V', () => {
    const pos = rpToPosition(2400);
    expect(pos.tier).toBe('epic');
  });

  it('rp=3150 → Legend V', () => {
    const pos = rpToPosition(3150);
    expect(pos.tier).toBe('legend');
  });

  it('rp=3900 → Mythic', () => {
    const pos = rpToPosition(3900);
    expect(pos.tier).toBe('mythic');
    expect(pos.mythicPoints).toBe(0);
  });

  it('rp=4100 → Mythic, 20 points', () => {
    const pos = rpToPosition(4100);
    expect(pos.tier).toBe('mythic');
    expect(pos.mythicPoints).toBe(20);
  });

  it('negative rp clamped to 0 (Warrior III)', () => {
    const pos = rpToPosition(-100);
    expect(pos.tier).toBe('warrior');
    expect(pos.rp).toBe(0);
  });

  it('rpToNextStar at 0 within a star = 50', () => {
    const pos = rpToPosition(0);
    expect(pos.rpToNextStar).toBe(50);
  });

  it('progressPct at midpoint = 0.5', () => {
    const pos = rpToPosition(25);
    expect(pos.progressPct).toBeCloseTo(0.5);
  });

  // Walk all tier floors to ensure no off-by-one
  it('every tier floor gives division N (lowest division)', () => {
    for (const tier of TIER_LADDER) {
      if (tier.key === 'mythic') continue;
      const pos = rpToPosition(tier.rpFloor);
      expect(pos.tier).toBe(tier.key);
      expect(pos.division).toBe(tier.divisions); // highest number = lowest division
      expect(pos.stars).toBe(0);
    }
  });
});

describe('computeSessionRp', () => {
  const baseStanding = {
    playerId: 'P1',
    rank: 1,
    matchesPlayed: 5,
    wins: 4,
    losses: 1,
    draws: 0,
    pointsFor: 80,
    pointsAgainst: 40,
    pointDiff: 40,
    winRate: 0.8,
    restCount: 0,
  };

  it('winner of 9 players earns positive RP', () => {
    const { delta } = computeSessionRp({
      standing: { ...baseStanding, rank: 1 },
      participantCount: 9,
      streakSessions: 3,
    });
    expect(delta).toBeGreaterThan(0);
  });

  it('last place loses RP', () => {
    const { delta } = computeSessionRp({
      standing: { ...baseStanding, rank: 9, wins: 0, losses: 5, pointDiff: -30 },
      participantCount: 9,
      streakSessions: 0,
    });
    expect(delta).toBeLessThan(0);
  });

  it('fewer than minMatchesGate → delta 0', () => {
    const { delta } = computeSessionRp({
      standing: { ...baseStanding, matchesPlayed: 2 },
      participantCount: 9,
      streakSessions: 5,
    });
    expect(delta).toBe(0);
  });

  it('delta clamped to [-20, 50]', () => {
    // Best possible scenario
    const { delta: best } = computeSessionRp({
      standing: { ...baseStanding, rank: 1, wins: 10, pointDiff: 100 },
      participantCount: 50,
      streakSessions: 99,
    });
    expect(best).toBeLessThanOrEqual(50);

    // Worst possible scenario
    const { delta: worst } = computeSessionRp({
      standing: { ...baseStanding, rank: 50, wins: 0, losses: 10, pointDiff: -100 },
      participantCount: 50,
      streakSessions: 0,
    });
    expect(worst).toBeGreaterThanOrEqual(-20);
  });

  it('streak participation bonus capped at 5', () => {
    const { breakdown } = computeSessionRp({
      standing: baseStanding,
      participantCount: 9,
      streakSessions: 99,
    });
    expect(breakdown.participation).toBe(5);
  });
});

describe('applyRp — floor protection', () => {
  it('gaining RP moves the player up', () => {
    const { rpAfter } = applyRp(500, 100);
    expect(rpAfter).toBe(600);
  });

  it('losing RP within a tier is allowed', () => {
    const { rpAfter, floorProtected } = applyRp(600, -100);
    expect(rpAfter).toBe(500);
    expect(floorProtected).toBe(false);
  });

  it('floor protection: cannot drop below current tier floor', () => {
    // Player at Elite (rp=450), loses 100 → would go to 350 which is Warrior
    const { rpAfter, floorProtected } = applyRp(450, -100);
    expect(rpAfter).toBe(450); // pinned to Elite floor
    expect(floorProtected).toBe(true);
  });

  it('cannot drop below 0', () => {
    const { rpAfter } = applyRp(0, -50);
    expect(rpAfter).toBe(0);
  });

  it('tier change detected on promotion', () => {
    const { tierChanged, promoted } = applyRp(449, 10); // Warrior → Elite
    expect(tierChanged).toBe(true);
    expect(promoted).toBe(true);
  });

  it('no tier change when staying within tier', () => {
    const { tierChanged } = applyRp(500, 10);
    expect(tierChanged).toBe(false);
  });
});
