/**
 * Demo data factory for mounting PlayerAnalytics on a dev route. Produces a believable
 * progression that crosses tiers (Warrior → Elite → Master) so the RP tier bands are
 * visible, plus a separate Mythic-level example. Not imported by production code.
 */

import type { PlayerSessionResultDoc, PlayerSportStatsDoc } from '@/types/player';
import type { RpEventDoc } from '@/types/stats';
import { rpToPosition } from '@/core/ranking/computeRp';

const DAY = 86_400_000;
/** A fixed anchor so the demo is deterministic across renders. */
const ANCHOR = Date.UTC(2026, 0, 1);

/** Deterministic pseudo-random in [0,1) from an integer seed. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * `count` session results, one per week, with a gently rising win rate and point
 * differential — the kind of run that would carry a player up a couple of tiers.
 */
export function demoResults(count: number): PlayerSessionResultDoc[] {
  const n = Math.max(0, count);
  return Array.from({ length: n }, (_, i) => {
    const matchesPlayed = 5 + Math.floor(rand(i) * 4); // 5..8
    const skill = 0.35 + (i / Math.max(1, n - 1)) * 0.4; // rises 0.35 → 0.75
    const wins = Math.min(matchesPlayed, Math.round(matchesPlayed * (skill + (rand(i + 7) - 0.5) * 0.2)));
    const losses = matchesPlayed - wins;
    const pointsFor = 90 + wins * 6 + Math.round(rand(i + 11) * 20);
    const pointsAgainst = 90 + losses * 6 + Math.round(rand(i + 13) * 20);
    const participantCount = 8;
    const rank = Math.max(1, Math.min(participantCount, Math.round(participantCount * (1 - skill)) + 1));

    return {
      id: `demo-result-${i}`,
      schemaVersion: 1,
      playerId: 'demo-player',
      sessionId: `demo-session-${i}`,
      sportId: 'padel',
      playedAt: ANCHOR + i * 7 * DAY,
      rank,
      participantCount,
      matchesPlayed,
      wins,
      losses,
      draws: 0,
      pointsFor,
      pointsAgainst,
      pointDiff: pointsFor - pointsAgainst,
      winRate: matchesPlayed > 0 ? wins / matchesPlayed : 0,
      rpDelta: 0,
      rpAfter: 0,
      tierAfter: 'warrior',
      divisionAfter: 1,
      starsAfter: 0,
    };
  });
}

/**
 * `count` RP events climbing from 0 into Master territory (floor 1050), so the Warrior,
 * Elite, and Master bands are all exercised. Includes one `session_reverted` event
 * partway through to show the reverted marker.
 */
export function demoRpEvents(count: number): RpEventDoc[] {
  const n = Math.max(0, count);
  const events: RpEventDoc[] = [];
  let rp = 0;
  const revertIndex = Math.floor(n / 2);

  for (let i = 0; i < n; i += 1) {
    const before = rpToPosition(rp);
    const reverted = i === revertIndex;
    // Mostly positive gains; the reverted event subtracts a chunk.
    const delta = reverted ? -24 : 20 + Math.round(rand(i) * 18);
    rp = Math.max(0, rp + delta);
    const after = rpToPosition(rp);

    events.push({
      id: `demo-rp-${i}`,
      schemaVersion: 1,
      playerId: 'demo-player',
      sportId: 'padel',
      sessionId: reverted ? `demo-session-${i - 1}` : `demo-session-${i}`,
      reason: reverted ? 'session_reverted' : 'session_result',
      breakdown: {
        placement: 18,
        winRate: 6,
        pointDiff: 4,
        participation: 3,
        clampApplied: false,
      },
      delta,
      rpBefore: before.rp,
      rpAfter: after.rp,
      tierBefore: before.tier,
      tierAfter: after.tier,
      createdAt: ANCHOR + i * 7 * DAY,
    });
  }

  return events;
}

/**
 * A Mythic-level RP history (crosses the 3900 floor and keeps climbing), so the full
 * tier band stack including Mythic is visible.
 */
export function demoMythicRpEvents(count: number): RpEventDoc[] {
  const n = Math.max(0, count);
  const events: RpEventDoc[] = [];
  // Start partway up so a modest count still reaches Mythic.
  let rp = 3600;

  for (let i = 0; i < n; i += 1) {
    const before = rpToPosition(rp);
    const delta = 30 + Math.round(rand(i + 3) * 25);
    rp = Math.max(0, rp + delta);
    const after = rpToPosition(rp);

    events.push({
      id: `demo-mythic-rp-${i}`,
      schemaVersion: 1,
      playerId: 'demo-mythic-player',
      sportId: 'padel',
      sessionId: `demo-mythic-session-${i}`,
      reason: 'session_result',
      breakdown: { placement: 24, winRate: 8, pointDiff: 6, participation: 4, clampApplied: false },
      delta,
      rpBefore: before.rp,
      rpAfter: after.rp,
      tierBefore: before.tier,
      tierAfter: after.tier,
      createdAt: ANCHOR + i * 7 * DAY,
    });
  }

  return events;
}

/** A stats doc consistent with a mid-climb Master player. */
export function demoStats(): PlayerSportStatsDoc {
  const results = demoResults(14);
  const matchesPlayed = results.reduce((s, r) => s + r.matchesPlayed, 0);
  const wins = results.reduce((s, r) => s + r.wins, 0);
  const pointsFor = results.reduce((s, r) => s + r.pointsFor, 0);
  const pointsAgainst = results.reduce((s, r) => s + r.pointsAgainst, 0);
  const position = rpToPosition(1180);

  return {
    id: 'padel',
    schemaVersion: 1,
    playerId: 'demo-player',
    sportId: 'padel',
    rp: position.rp,
    tier: position.tier,
    division: position.division,
    stars: position.stars,
    peakRp: 1240,
    matchesPlayed,
    wins,
    losses: matchesPlayed - wins,
    draws: 0,
    pointsFor,
    pointsAgainst,
    sessionsPlayed: results.length,
    podiumFinishes: { first: 3, second: 4, third: 2 },
    currentStreak: 3,
    longestStreak: 6,
    lastPlayedAt: results.at(-1)?.playedAt ?? ANCHOR,
    updatedAt: ANCHOR + 14 * 7 * DAY,
  };
}
