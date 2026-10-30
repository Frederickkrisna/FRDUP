/**
 * Test fixture builders for the analytics transforms. Kept beside the tests so the
 * production bundle never sees them.
 */

import type { PlayerSessionResultDoc, PlayerSportStatsDoc } from '@/types/player';
import type { RpEventDoc, RpBreakdown } from '@/types/stats';
import type { TierKey } from '@/types/rank';

const ZERO_BREAKDOWN: RpBreakdown = {
  placement: 0,
  winRate: 0,
  pointDiff: 0,
  participation: 0,
  clampApplied: false,
};

export function makeResult(overrides: Partial<PlayerSessionResultDoc> = {}): PlayerSessionResultDoc {
  const matchesPlayed = overrides.matchesPlayed ?? 6;
  const wins = overrides.wins ?? 3;
  return {
    id: overrides.id ?? 'result-1',
    schemaVersion: 1,
    playerId: 'player-1',
    sessionId: overrides.sessionId ?? 'session-1',
    sportId: 'padel',
    playedAt: overrides.playedAt ?? 1_700_000_000_000,
    rank: overrides.rank ?? 2,
    participantCount: overrides.participantCount ?? 8,
    matchesPlayed,
    wins,
    losses: overrides.losses ?? Math.max(0, matchesPlayed - wins),
    draws: overrides.draws ?? 0,
    pointsFor: overrides.pointsFor ?? 120,
    pointsAgainst: overrides.pointsAgainst ?? 96,
    pointDiff: overrides.pointDiff ?? 24,
    winRate: overrides.winRate ?? (matchesPlayed > 0 ? wins / matchesPlayed : 0),
    rpDelta: overrides.rpDelta ?? 12,
    rpAfter: overrides.rpAfter ?? 300,
    tierAfter: overrides.tierAfter ?? 'warrior',
    divisionAfter: overrides.divisionAfter ?? 1,
    starsAfter: overrides.starsAfter ?? 1,
  };
}

export function makeRpEvent(overrides: Partial<RpEventDoc> = {}): RpEventDoc {
  return {
    id: overrides.id ?? 'rp-1',
    schemaVersion: 1,
    playerId: 'player-1',
    sportId: 'padel',
    sessionId: overrides.sessionId ?? 'session-1',
    reason: overrides.reason ?? 'session_result',
    breakdown: overrides.breakdown ?? ZERO_BREAKDOWN,
    delta: overrides.delta ?? 20,
    rpBefore: overrides.rpBefore ?? 100,
    rpAfter: overrides.rpAfter ?? 120,
    tierBefore: overrides.tierBefore ?? 'warrior',
    tierAfter: overrides.tierAfter ?? 'warrior',
    createdAt: overrides.createdAt ?? 1_700_000_000_000,
  };
}

export function makeStats(overrides: Partial<PlayerSportStatsDoc> = {}): PlayerSportStatsDoc {
  return {
    id: 'padel',
    schemaVersion: 1,
    playerId: 'player-1',
    sportId: 'padel',
    rp: overrides.rp ?? 300,
    tier: (overrides.tier ?? 'warrior') as TierKey,
    division: overrides.division ?? 1,
    stars: overrides.stars ?? 1,
    peakRp: overrides.peakRp ?? 320,
    matchesPlayed: overrides.matchesPlayed ?? 60,
    wins: overrides.wins ?? 33,
    losses: overrides.losses ?? 25,
    draws: overrides.draws ?? 2,
    pointsFor: overrides.pointsFor ?? 1200,
    pointsAgainst: overrides.pointsAgainst ?? 1100,
    sessionsPlayed: overrides.sessionsPlayed ?? 10,
    podiumFinishes: overrides.podiumFinishes ?? { first: 2, second: 3, third: 1 },
    currentStreak: overrides.currentStreak ?? 2,
    longestStreak: overrides.longestStreak ?? 5,
    lastPlayedAt: overrides.lastPlayedAt ?? 1_700_000_000_000,
    updatedAt: overrides.updatedAt ?? 1_700_000_000_000,
  };
}
