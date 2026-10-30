/**
 * Session finish: standings -> RP -> commit payload. Pure; the repository performs the batched write.
 * See docs/implementation_be.md §6.3.5.
 */

import type { Id, Millis } from '@/types/common';
import type { RoundDoc } from '@/types/round';
import type { SessionDoc } from '@/types/session';
import type { SportPlugin } from '@/types/sport';
import type { PlayerSportStatsDoc, PlayerSportSummary } from '@/types/player';
import type { RpBreakdown, SessionCommitPayload } from '@/types/stats';
import type { TierKey } from '@/types/rank';
import type { StandingRow } from '@/core/matchmaking/types';
import { computeStandings } from '@/core/standings/computeStandings';
import { applyRp, computeSessionRp, rpToPosition, type RankPosition } from '@/core/ranking/computeRp';
import { isWithinWeeklyWindow } from '@/core/utils/date';
import { SCHEMA_VERSION, isMatchSettled } from './sessionEngine';

const DAY_MS = 86_400_000;

/** RP gate: fewer matches than this in a session never moves the ladder. */
export const MIN_MATCHES_GATE = 3;

export function unsettledMatchCount(rounds: RoundDoc[]): number {
  return rounds.reduce((n, r) => n + r.matches.filter((m) => !isMatchSettled(m)).length, 0);
}

export function emptyStats(playerId: Id, sportId: SessionDoc['sportId'], now: Millis): PlayerSportStatsDoc {
  const pos = rpToPosition(0);
  return {
    id: sportId,
    schemaVersion: SCHEMA_VERSION,
    playerId,
    sportId,
    rp: 0,
    tier: pos.tier,
    division: pos.division,
    stars: pos.stars,
    peakRp: 0,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    sessionsPlayed: 0,
    podiumFinishes: { first: 0, second: 0, third: 0 },
    currentStreak: 0,
    longestStreak: 0,
    lastPlayedAt: null,
    updatedAt: now,
  };
}

/**
 * Consecutive-session streak with a weekly cadence tolerance of ±3 days.
 *   same week (< 4 days) -> unchanged (min 1) · 4..10 days -> +1 · otherwise -> reset to 1.
 */
export function nextStreak(prev: { lastPlayedAt: Millis | null; currentStreak: number }, playedAt: Millis): number {
  if (prev.lastPlayedAt === null) return 1;
  const gapDays = (playedAt - prev.lastPlayedAt) / DAY_MS;
  if (gapDays < 4) return Math.max(1, prev.currentStreak);
  return isWithinWeeklyWindow(prev.lastPlayedAt, playedAt) ? prev.currentStreak + 1 : 1;
}

export interface RankChange {
  playerId: Id;
  rank: number;
  delta: number;
  breakdown: RpBreakdown;
  from: RankPosition;
  to: RankPosition;
  tierChanged: boolean;
  promoted: boolean;
  floorProtected: boolean;
}

export interface FinishResult {
  /** Standings across ranked participants only (guests are excluded from the ladder). */
  standings: StandingRow[];
  payload: SessionCommitPayload;
  changes: RankChange[];
  /** Tier promotions, in rank order, for the tier-up modal queue. */
  promotions: RankChange[];
  podium: Id[];
}

export interface FinishArgs {
  session: SessionDoc;
  rounds: RoundDoc[];
  plugin: SportPlugin;
  /** Existing per-sport stats for each participant (null = first time). */
  prior: Record<Id, PlayerSportStatsDoc | null | undefined>;
  now: Millis;
}

export function buildFinish({ session, rounds, plugin, prior, now }: FinishArgs): FinishResult {
  const ranked = session.participants.filter((p) => p.includeInRanking);
  const standings = computeStandings(ranked, rounds, plugin, session.scoreInput);
  const participantCount = standings.filter((s) => s.matchesPlayed > 0).length;
  const playedRows = standings.filter((s) => s.matchesPlayed > 0);

  const perPlayer: SessionCommitPayload['perPlayer'] = [];
  const changes: RankChange[] = [];

  for (const row of playedRows) {
    const before = prior[row.playerId] ?? emptyStats(row.playerId, session.sportId, now);
    const streak = nextStreak(before, session.playedAt);
    const { delta, breakdown } = computeSessionRp({
      standing: row,
      participantCount,
      streakSessions: Math.max(0, streak - 1),
      minMatchesGate: MIN_MATCHES_GATE,
    });
    const applied = applyRp(before.rp, delta);
    const tierBefore: TierKey = before.tier;

    const stats: PlayerSportStatsDoc = {
      ...before,
      rp: applied.rpAfter,
      tier: applied.to.tier,
      division: applied.to.division,
      stars: applied.to.stars,
      peakRp: Math.max(before.peakRp, applied.rpAfter),
      matchesPlayed: before.matchesPlayed + row.matchesPlayed,
      wins: before.wins + row.wins,
      losses: before.losses + row.losses,
      draws: before.draws + row.draws,
      pointsFor: before.pointsFor + row.pointsFor,
      pointsAgainst: before.pointsAgainst + row.pointsAgainst,
      sessionsPlayed: before.sessionsPlayed + 1,
      podiumFinishes: {
        first: before.podiumFinishes.first + (row.rank === 1 ? 1 : 0),
        second: before.podiumFinishes.second + (row.rank === 2 ? 1 : 0),
        third: before.podiumFinishes.third + (row.rank === 3 ? 1 : 0),
      },
      currentStreak: streak,
      longestStreak: Math.max(before.longestStreak, streak),
      lastPlayedAt: session.playedAt,
      updatedAt: now,
    };

    const summary: PlayerSportSummary = {
      tier: stats.tier,
      division: stats.division,
      stars: stats.stars,
      rp: stats.rp,
      matchesPlayed: stats.matchesPlayed,
      wins: stats.wins,
      sessionsPlayed: stats.sessionsPlayed,
      lastPlayedAt: stats.lastPlayedAt,
    };

    perPlayer.push({
      playerId: row.playerId,
      result: {
        id: session.id,
        schemaVersion: SCHEMA_VERSION,
        playerId: row.playerId,
        sessionId: session.id,
        sportId: session.sportId,
        playedAt: session.playedAt,
        rank: row.rank,
        participantCount,
        matchesPlayed: row.matchesPlayed,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        pointDiff: row.pointDiff,
        winRate: row.winRate,
        rpDelta: applied.rpAfter - before.rp,
        rpAfter: applied.rpAfter,
        tierAfter: stats.tier,
        divisionAfter: stats.division,
        starsAfter: stats.stars,
      },
      statsPatch: stats,
      rpEvent: {
        playerId: row.playerId,
        sportId: session.sportId,
        sessionId: session.id,
        reason: 'session_result',
        breakdown,
        delta,
        rpBefore: before.rp,
        rpAfter: applied.rpAfter,
        tierBefore,
        tierAfter: stats.tier,
        createdAt: now,
      },
      summaryPatch: summary,
    });

    changes.push({
      playerId: row.playerId,
      rank: row.rank,
      delta: applied.rpAfter - before.rp,
      breakdown,
      from: applied.from,
      to: applied.to,
      tierChanged: applied.tierChanged,
      promoted: applied.promoted,
      floorProtected: applied.floorProtected,
    });
  }

  return {
    standings,
    payload: { sessionId: session.id, sportId: session.sportId, playedAt: session.playedAt, perPlayer },
    changes,
    promotions: changes.filter((c) => c.promoted),
    podium: playedRows.slice(0, 3).map((r) => r.playerId),
  };
}

/** Counter arithmetic used when reverting a committed session (inverse of buildFinish's stats update). */
export function revertStats(
  current: PlayerSportStatsDoc,
  result: { rank: number; matchesPlayed: number; wins: number; losses: number; draws: number; pointsFor: number; pointsAgainst: number },
  rpBefore: number,
  now: Millis,
): PlayerSportStatsDoc {
  const pos = rpToPosition(rpBefore);
  return {
    ...current,
    rp: rpBefore,
    tier: pos.tier,
    division: pos.division,
    stars: pos.stars,
    matchesPlayed: Math.max(0, current.matchesPlayed - result.matchesPlayed),
    wins: Math.max(0, current.wins - result.wins),
    losses: Math.max(0, current.losses - result.losses),
    draws: Math.max(0, current.draws - result.draws),
    pointsFor: Math.max(0, current.pointsFor - result.pointsFor),
    pointsAgainst: Math.max(0, current.pointsAgainst - result.pointsAgainst),
    sessionsPlayed: Math.max(0, current.sessionsPlayed - 1),
    podiumFinishes: {
      first: Math.max(0, current.podiumFinishes.first - (result.rank === 1 ? 1 : 0)),
      second: Math.max(0, current.podiumFinishes.second - (result.rank === 2 ? 1 : 0)),
      third: Math.max(0, current.podiumFinishes.third - (result.rank === 3 ? 1 : 0)),
    },
    updatedAt: now,
  };
}
