import { describe, expect, it } from 'vitest';
import { getSportPlugin } from '@/core/sports/registry';
import type { RoundDoc } from '@/types/round';
import type { PlayerSportStatsDoc } from '@/types/player';
import { buildFinish, emptyStats, nextStreak, revertStats, unsettledMatchCount } from '../finish';
import { buildNextRound, completeMatch, setMatchScore } from '../sessionEngine';
import { makeSession } from './helpers';

const plugin = getSportPlugin('badminton');
const DAY = 86_400_000;

function playSession(rounds = 8) {
  const session = makeSession('badminton', 9, 2);
  const spec = session.scoreInput;
  const done: RoundDoc[] = [];
  for (let i = 0; i < rounds; i++) {
    let r = buildNextRound({ session, rounds: done, plugin, seed: 50 + i, uid: 'h', now: i });
    for (const m of r.matches) {
      // team 0 wins, margin varies by round so point diffs differ between players
      r = setMatchScore(r, m.id, { teamIndex: 0, value: 21, mode: 'set' }, plugin, spec, 'h', i);
      r = setMatchScore(r, m.id, { teamIndex: 1, value: 8 + ((i * 3) % 11), mode: 'set' }, plugin, spec, 'h', i);
      r = completeMatch(r, m.id, plugin, spec, 'h', i);
    }
    done.push(r);
  }
  return { session, rounds: done };
}

describe('nextStreak', () => {
  it('first session starts at 1', () => {
    expect(nextStreak({ lastPlayedAt: null, currentStreak: 0 }, 1000 * DAY)).toBe(1);
  });
  it('same week keeps the streak', () => {
    expect(nextStreak({ lastPlayedAt: 100 * DAY, currentStreak: 3 }, 102 * DAY)).toBe(3);
  });
  it('weekly cadence (4..10 days) increments', () => {
    expect(nextStreak({ lastPlayedAt: 100 * DAY, currentStreak: 3 }, 107 * DAY)).toBe(4);
    expect(nextStreak({ lastPlayedAt: 100 * DAY, currentStreak: 3 }, 104 * DAY)).toBe(4);
    expect(nextStreak({ lastPlayedAt: 100 * DAY, currentStreak: 3 }, 110 * DAY)).toBe(4);
  });
  it('a gap over 10 days resets', () => {
    expect(nextStreak({ lastPlayedAt: 100 * DAY, currentStreak: 5 }, 111 * DAY)).toBe(1);
  });
});

describe('buildFinish', () => {
  it('counts unsettled matches', () => {
    const session = makeSession('badminton', 9, 2);
    const r = buildNextRound({ session, rounds: [], plugin, seed: 1, uid: 'h', now: 1 });
    expect(unsettledMatchCount([r])).toBe(2);
  });

  it('commits a full session: every player who played gets a result, RP within bounds', () => {
    const { session, rounds } = playSession();
    const out = buildFinish({ session, rounds, plugin, prior: {}, now: 9999 });
    expect(out.payload.perPlayer).toHaveLength(9);
    expect(out.standings[0]!.rank).toBe(1);
    for (const p of out.payload.perPlayer) {
      expect(p.rpEvent.delta).toBeGreaterThanOrEqual(-20);
      expect(p.rpEvent.delta).toBeLessThanOrEqual(50);
      expect(p.result.participantCount).toBe(9);
      expect(p.statsPatch.sessionsPlayed).toBe(1);
      expect(p.statsPatch.rp).toBeGreaterThanOrEqual(0);
      expect(p.summaryPatch.rp).toBe(p.statsPatch.rp);
      // 8 rounds, 2 courts, 9 players → everyone plays at least 3 (gate)
      expect(p.result.matchesPlayed).toBeGreaterThanOrEqual(3);
    }
    // winner's delta is the largest
    const best = Math.max(...out.payload.perPlayer.map((p) => p.rpEvent.delta));
    expect(out.payload.perPlayer.find((p) => p.playerId === out.podium[0])!.rpEvent.delta).toBe(best);
    expect(out.podium).toHaveLength(3);
  });

  it('is deterministic', () => {
    const { session, rounds } = playSession();
    const a = buildFinish({ session, rounds, plugin, prior: {}, now: 1 });
    const b = buildFinish({ session, rounds, plugin, prior: {}, now: 1 });
    expect(a).toEqual(b);
  });

  it('guests (includeInRanking=false) never reach the ladder', () => {
    const { session, rounds } = playSession(4);
    const guest = { ...session, participants: session.participants.map((p, i) => (i === 0 ? { ...p, isGuest: true, includeInRanking: false } : p)) };
    const out = buildFinish({ session: guest, rounds, plugin, prior: {}, now: 1 });
    expect(out.payload.perPlayer.some((p) => p.playerId === 'p1')).toBe(false);
    expect(out.standings.some((s) => s.playerId === 'p1')).toBe(false);
  });

  it('min-matches gate: a player with < 3 matches gets delta 0 but is still recorded', () => {
    const { session, rounds } = playSession(2);
    const out = buildFinish({ session, rounds, plugin, prior: {}, now: 1 });
    for (const p of out.payload.perPlayer) {
      expect(p.result.matchesPlayed).toBeLessThan(3);
      expect(p.rpEvent.delta).toBe(0);
    }
  });

  it('tier floor protection and promotion are reported', () => {
    const { session, rounds } = playSession();
    const topId = buildFinish({ session, rounds, plugin, prior: {}, now: 1 }).podium[0]!;
    // Place the winner 10 RP below Elite (450): a big win must promote Warrior → Elite.
    const prior: Record<string, PlayerSportStatsDoc> = {
      [topId]: { ...emptyStats(topId, 'badminton', 0), rp: 440, tier: 'warrior', division: 1, stars: 2, lastPlayedAt: session.playedAt - 7 * DAY, currentStreak: 2 },
    };
    const out = buildFinish({ session, rounds, plugin, prior, now: 1 });
    const change = out.changes.find((c) => c.playerId === topId)!;
    expect(change.promoted).toBe(true);
    expect(change.to.tier).toBe('elite');
    expect(out.promotions.map((c) => c.playerId)).toContain(topId);
    const evt = out.payload.perPlayer.find((p) => p.playerId === topId)!.rpEvent;
    expect(evt.tierBefore).toBe('warrior');
    expect(evt.tierAfter).toBe('elite');
    expect(evt.rpAfter - evt.rpBefore).toBe(evt.delta);
  });

  it('streak adds participation RP on weekly cadence', () => {
    const { session, rounds } = playSession();
    const id = 'p3';
    const mk = (streak: number) => ({
      [id]: { ...emptyStats(id, 'badminton', 0), rp: 600, tier: 'elite' as const, lastPlayedAt: session.playedAt - 7 * DAY, currentStreak: streak },
    });
    const low = buildFinish({ session, rounds, plugin, prior: mk(0), now: 1 });
    const high = buildFinish({ session, rounds, plugin, prior: mk(4), now: 1 });
    const pLow = low.payload.perPlayer.find((p) => p.playerId === id)!;
    const pHigh = high.payload.perPlayer.find((p) => p.playerId === id)!;
    expect(pHigh.rpEvent.breakdown.participation).toBeGreaterThan(pLow.rpEvent.breakdown.participation);
    expect(pHigh.statsPatch.currentStreak).toBe(5);
  });
});

describe('revertStats', () => {
  it('is the inverse of the counter updates in buildFinish', () => {
    const { session, rounds } = playSession();
    const before = Object.fromEntries(
      session.participants.map((p) => [p.playerId, { ...emptyStats(p.playerId, 'badminton', 0), rp: 520, tier: 'elite' as const, matchesPlayed: 10, wins: 4, losses: 6, pointsFor: 100, pointsAgainst: 120, sessionsPlayed: 2 }]),
    );
    const out = buildFinish({ session, rounds, plugin, prior: before, now: 5 });
    for (const p of out.payload.perPlayer) {
      const reverted = revertStats(p.statsPatch as PlayerSportStatsDoc, p.result, p.rpEvent.rpBefore, 6);
      const b = before[p.playerId]!;
      expect(reverted.rp).toBe(b.rp);
      expect(reverted.matchesPlayed).toBe(b.matchesPlayed);
      expect(reverted.wins).toBe(b.wins);
      expect(reverted.losses).toBe(b.losses);
      expect(reverted.pointsFor).toBe(b.pointsFor);
      expect(reverted.sessionsPlayed).toBe(b.sessionsPlayed);
      expect(reverted.podiumFinishes).toEqual(b.podiumFinishes);
    }
  });
});
