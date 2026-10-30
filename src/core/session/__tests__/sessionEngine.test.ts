import { describe, expect, it } from 'vitest';
import { getSportPlugin } from '@/core/sports/registry';
import type { RoundDoc } from '@/types/round';
import type { SessionDoc } from '@/types/session';
import { makeSession } from './helpers';
import {
  addParticipant,
  allMatchesSettled,
  buildNextRound,
  completeMatch,
  completionBlocker,
  eligiblePlayerIds,
  LIMITS,
  removeParticipant,
  resolveMatchShape,
  rotationPreview,
  reopenMatch,
  resetMatchScore,
  setCourtActive,
  setMatchScore,
  voidMatch,
  voidUnsettled,
} from '../sessionEngine';

const plugin = getSportPlugin('badminton');

function firstRound(): { session: SessionDoc; round: RoundDoc } {
  const session = makeSession('badminton', 9, 2);
  const round = buildNextRound({ session, rounds: [], plugin, seed: 7, uid: 'host', now: 1000 });
  return { session, round };
}

describe('buildNextRound', () => {
  it('9 players / 2 courts → 2 matches, 1 resting, scores initialised, revision 1', () => {
    const { round } = firstRound();
    expect(round.roundNumber).toBe(1);
    expect(round.matches).toHaveLength(2);
    expect(round.restingPlayerIds).toHaveLength(1);
    expect(round.revision).toBe(1);
    for (const m of round.matches) {
      expect(m.status).toBe('scheduled');
      expect(m.startedAt).toBeNull();
      expect(m.score.points).toEqual([0, 0]);
      expect(m.teams.flat()).toHaveLength(4);
    }
  });

  it('is deterministic for a given seed', () => {
    const session = makeSession('badminton', 9, 2);
    const a = buildNextRound({ session, rounds: [], plugin, seed: 11, uid: 'h', now: 1 });
    const b = buildNextRound({ session, rounds: [], plugin, seed: 11, uid: 'h', now: 1 });
    expect(a.matches.map((m) => m.teams)).toEqual(b.matches.map((m) => m.teams));
    expect(a.restingPlayerIds).toEqual(b.restingPlayerIds);
  });

  it('padel initialises fixed-sum scores (0 / 0)', () => {
    const session = makeSession('padel', 8, 2);
    const round = buildNextRound({ session, rounds: [], plugin: getSportPlugin('padel'), seed: 3, uid: 'h', now: 1 });
    expect(round.matches[0]!.score.points).toEqual([0, 0]);
  });
});

describe('scoring flow', () => {
  it('first edit marks the match in_progress and bumps the revision; input is not mutated', () => {
    const { session, round } = firstRound();
    const frozen = JSON.stringify(round);
    const matchId = round.matches[0]!.id;
    const next = setMatchScore(round, matchId, { teamIndex: 0, value: 1, mode: 'delta' }, plugin, session.scoreInput, 'host', 2000);
    expect(JSON.stringify(round)).toBe(frozen);
    const m = next.matches[0]!;
    expect(m.status).toBe('in_progress');
    expect(m.startedAt).toBe(2000);
    expect(m.score.points).toEqual([1, 0]);
    expect(next.revision).toBe(2);
    expect(next.lastWriterUid).toBe('host');
  });

  it('race_to_n cannot complete until decided; completes at 21–15', () => {
    const { session, round } = firstRound();
    const spec = session.scoreInput;
    const id = round.matches[0]!.id;
    expect(completionBlocker(round.matches[0]!, plugin, spec)).toBe('session.court.blocker.noScore');

    let r = setMatchScore(round, id, { teamIndex: 0, value: 10, mode: 'set' }, plugin, spec, 'h', 1);
    expect(completionBlocker(r.matches[0]!, plugin, spec)).toBe('session.court.blocker.notDecided');
    expect(completeMatch(r, id, plugin, spec, 'h', 2).matches[0]!.status).toBe('in_progress');

    r = setMatchScore(r, id, { teamIndex: 0, value: 21, mode: 'set' }, plugin, spec, 'h', 3);
    r = setMatchScore(r, id, { teamIndex: 1, value: 15, mode: 'set' }, plugin, spec, 'h', 4);
    const done = completeMatch(r, id, plugin, spec, 'h', 5);
    expect(done.matches[0]!.status).toBe('completed');
    expect(done.matches[0]!.score.winnerTeamIndex).toBe(0);
    expect(done.matches[0]!.completedAt).toBe(5);
  });

  it('deuce: 21–20 is not decided, 22–20 is', () => {
    const { session, round } = firstRound();
    const spec = session.scoreInput;
    const id = round.matches[0]!.id;
    let r = setMatchScore(round, id, { teamIndex: 0, value: 21, mode: 'set' }, plugin, spec, 'h', 1);
    r = setMatchScore(r, id, { teamIndex: 1, value: 20, mode: 'set' }, plugin, spec, 'h', 2);
    expect(completionBlocker(r.matches[0]!, plugin, spec)).toBe('session.court.blocker.notDecided');
    r = setMatchScore(r, id, { teamIndex: 0, value: 22, mode: 'set' }, plugin, spec, 'h', 3);
    expect(completionBlocker(r.matches[0]!, plugin, spec)).toBeNull();
  });

  it('round completes only when every match is settled; reopen reverts it', () => {
    const { session, round } = firstRound();
    const spec = session.scoreInput;
    let r = round;
    for (const m of round.matches) {
      r = setMatchScore(r, m.id, { teamIndex: 0, value: 21, mode: 'set' }, plugin, spec, 'h', 1);
      r = setMatchScore(r, m.id, { teamIndex: 1, value: 5, mode: 'set' }, plugin, spec, 'h', 2);
    }
    r = completeMatch(r, round.matches[0]!.id, plugin, spec, 'h', 3);
    expect(allMatchesSettled(r)).toBe(false);
    expect(r.status).toBe('in_progress');
    r = completeMatch(r, round.matches[1]!.id, plugin, spec, 'h', 4);
    expect(allMatchesSettled(r)).toBe(true);
    expect(r.status).toBe('completed');
    expect(r.completedAt).toBe(4);
    r = reopenMatch(r, round.matches[1]!.id, 'h', 5);
    expect(r.status).toBe('in_progress');
    expect(r.completedAt).toBeNull();
  });

  it('void and voidUnsettled settle matches; reset returns a match to scheduled', () => {
    const { session, round } = firstRound();
    const spec = session.scoreInput;
    const voided = voidMatch(round, round.matches[0]!.id, 'h', 1);
    expect(voided.matches[0]!.status).toBe('voided');
    expect(allMatchesSettled(voided)).toBe(false);
    const all = voidUnsettled(voided, 'h', 2);
    expect(allMatchesSettled(all)).toBe(true);
    expect(all.status).toBe('completed');

    const touched = setMatchScore(round, round.matches[0]!.id, { teamIndex: 0, value: 3, mode: 'set' }, plugin, spec, 'h', 1);
    const reset = resetMatchScore(touched, round.matches[0]!.id, plugin, spec, 'h', 2);
    expect(reset.matches[0]!.status).toBe('scheduled');
    expect(reset.matches[0]!.score.points).toEqual([0, 0]);
  });

  it('padel: a fresh 0–21 cannot be completed until touched, then any split completes', () => {
    const session = makeSession('padel', 4, 1);
    const padel = getSportPlugin('padel');
    const round = buildNextRound({ session, rounds: [], plugin: padel, seed: 1, uid: 'h', now: 1 });
    const id = round.matches[0]!.id;
    expect(completionBlocker(round.matches[0]!, padel, session.scoreInput)).toBe('session.court.blocker.noScore');
    let r = setMatchScore(round, id, { teamIndex: 0, value: 15, mode: 'set' }, padel, session.scoreInput, 'h', 1);
    expect(r.matches[0]!.score.points).toEqual([15, 6]);
    r = completeMatch(r, id, padel, session.scoreInput, 'h', 2);
    expect(r.matches[0]!.status).toBe('completed');
  });
});

describe('participants and courts', () => {
  it('eligibility honours join/leave windows', () => {
    const s = makeSession('badminton', 5, 1);
    const withLate = addParticipant(s, { ...s.participants[0]!, playerId: 'late', name: 'Late' }, 3, 1);
    expect(eligiblePlayerIds(withLate.participants, 2)).not.toContain('late');
    expect(eligiblePlayerIds(withLate.participants, 3)).toContain('late');
    const left = removeParticipant(withLate, 'p1', 4, 2);
    expect(eligiblePlayerIds(left.participants, 3)).toContain('p1');
    expect(eligiblePlayerIds(left.participants, 4)).not.toContain('p1');
  });

  it('caps participants at the hard limit and ignores duplicates', () => {
    let s = makeSession('badminton', LIMITS.participants, 1);
    const extra = { ...s.participants[0]!, playerId: 'extra' };
    expect(addParticipant(s, extra, 1, 1).participants).toHaveLength(LIMITS.participants);
    s = makeSession('badminton', 5, 1);
    expect(addParticipant(s, s.participants[0]!, 1, 1).participants).toHaveLength(5);
  });

  it('court toggling', () => {
    const s = makeSession('badminton', 8, 2);
    const off = setCourtActive(s, 'c2', false, 1);
    expect(off.courts.find((c) => c.id === 'c2')!.isActive).toBe(false);
    const round = buildNextRound({ session: off, rounds: [], plugin, seed: 5, uid: 'h', now: 1 });
    expect(round.matches).toHaveLength(1);
    expect(round.restingPlayerIds).toHaveLength(4);
  });
});

describe('full session simulation (9 players, 2 courts, 8 rounds)', () => {
  it('rest counts differ by at most 1 and nobody is double-booked', () => {
    const session = makeSession('badminton', 9, 2);
    const spec = session.scoreInput;
    const rounds: RoundDoc[] = [];
    for (let i = 0; i < 8; i++) {
      let r = buildNextRound({ session, rounds, plugin, seed: 100 + i, uid: 'h', now: i });
      const seen = r.matches.flatMap((m) => m.teams.flat()).concat(r.restingPlayerIds);
      expect(new Set(seen).size).toBe(9);
      for (const m of r.matches) {
        r = setMatchScore(r, m.id, { teamIndex: 0, value: 21, mode: 'set' }, plugin, spec, 'h', i);
        r = setMatchScore(r, m.id, { teamIndex: 1, value: 10 + (i % 5), mode: 'set' }, plugin, spec, 'h', i);
        r = completeMatch(r, m.id, plugin, spec, 'h', i);
      }
      expect(r.status).toBe('completed');
      rounds.push(r);
    }
    const rests = new Map<string, number>();
    for (const p of session.participants) rests.set(p.playerId, 0);
    for (const r of rounds) for (const id of r.restingPlayerIds) rests.set(id, (rests.get(id) ?? 0) + 1);
    const values = [...rests.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });
});

describe('match shape settings', () => {
  it('singleMode / doublesMode switch 1v1 and 2v2; other sports are unaffected', () => {
    expect(resolveMatchShape(getSportPlugin('badminton'), {})).toEqual({ teamsPerMatch: 2, playersPerTeam: 2 });
    expect(resolveMatchShape(getSportPlugin('badminton'), { singleMode: true })).toEqual({ teamsPerMatch: 2, playersPerTeam: 1 });
    expect(resolveMatchShape(getSportPlugin('pingpong'), { doublesMode: true })).toEqual({ teamsPerMatch: 2, playersPerTeam: 2 });
    expect(resolveMatchShape(getSportPlugin('billiard'), {})).toEqual({ teamsPerMatch: 2, playersPerTeam: 1 });
    expect(resolveMatchShape(getSportPlugin('mahjong'), { doublesMode: true })).toEqual({ teamsPerMatch: 4, playersPerTeam: 1 });
  });

  it('badminton singles really generates 1v1 matches', () => {
    const session = { ...makeSession('badminton', 5, 2), sportConfig: { singleMode: true } };
    const round = buildNextRound({ session, rounds: [], plugin, seed: 4, uid: 'h', now: 1 });
    expect(round.matches).toHaveLength(2);
    for (const m of round.matches) expect(m.teams.map((t) => t.length)).toEqual([1, 1]);
    expect(round.restingPlayerIds).toHaveLength(1);
  });

  it('rotation preview matches the documented examples', () => {
    const doubles = { teamsPerMatch: 2, playersPerTeam: 2 };
    expect(rotationPreview(9, 2, doubles)).toEqual({ playing: 8, resting: 1, activeCourts: 2 });
    expect(rotationPreview(5, 1, doubles)).toEqual({ playing: 4, resting: 1, activeCourts: 1 });
    expect(rotationPreview(3, 2, doubles)).toEqual({ playing: 0, resting: 3, activeCourts: 0 });
    expect(rotationPreview(20, 2, doubles)).toEqual({ playing: 8, resting: 12, activeCourts: 2 });
  });
});