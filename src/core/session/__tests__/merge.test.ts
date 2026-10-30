import { describe, expect, it } from 'vitest';
import { getSportPlugin } from '@/core/sports/registry';
import type { RoundDoc } from '@/types/round';
import { changedMatchIds, mergeRounds } from '../merge';
import { buildNextRound, completeMatch, setMatchScore, swapInRound } from '../sessionEngine';
import { makeSession } from './helpers';

const plugin = getSportPlugin('badminton');
const session = makeSession('badminton', 8, 2);
const spec = session.scoreInput;

function base(): RoundDoc {
  return buildNextRound({ session, rounds: [], plugin, seed: 9, uid: 'host', now: 100 });
}

describe('mergeRounds', () => {
  it('two devices scoring different courts: both edits survive', () => {
    const r0 = base();
    const [m1, m2] = r0.matches;
    const host = setMatchScore(r0, m1!.id, { teamIndex: 0, value: 7, mode: 'set' }, plugin, spec, 'host', 200);
    const cohost = setMatchScore(r0, m2!.id, { teamIndex: 1, value: 9, mode: 'set' }, plugin, spec, 'co', 300);

    const asHost = mergeRounds(host, cohost, 'host', 'host', 400);
    expect(asHost.matches[0]!.score.points).toEqual([7, 0]);
    expect(asHost.matches[1]!.score.points).toEqual([0, 9]);
    expect(asHost.revision).toBeGreaterThan(Math.max(host.revision, cohost.revision));

    const asCo = mergeRounds(cohost, host, 'cohost', 'co', 400);
    expect(asCo.matches.map((m) => m.score.points)).toEqual(asHost.matches.map((m) => m.score.points));
  });

  it('same court: the most recently edited score wins, on both sides', () => {
    const r0 = base();
    const id = r0.matches[0]!.id;
    const host = setMatchScore(r0, id, { teamIndex: 0, value: 11, mode: 'set' }, plugin, spec, 'host', 500);
    const cohost = setMatchScore(r0, id, { teamIndex: 0, value: 12, mode: 'set' }, plugin, spec, 'co', 600);
    expect(mergeRounds(host, cohost, 'host', 'host', 700).matches[0]!.score.points[0]).toBe(12);
    expect(mergeRounds(cohost, host, 'cohost', 'co', 700).matches[0]!.score.points[0]).toBe(12);
  });

  it("teams defer to the host's version even when the co-host's score is newer", () => {
    const r0 = base();
    const [a, b] = [r0.matches[0]!.teams[0]![0]!, r0.matches[1]!.teams[0]![0]!];
    const host = swapInRound(r0, a, b, 'host', 800); // host re-pairs
    const cohost = setMatchScore(r0, r0.matches[0]!.id, { teamIndex: 0, value: 5, mode: 'set' }, plugin, spec, 'co', 900);
    const merged = mergeRounds(host, cohost, 'host', 'host', 1000);
    expect(merged.matches[0]!.teams).toEqual(host.matches[0]!.teams);
    expect(merged.matches[0]!.score.points[0]).toBe(5);
    const asCo = mergeRounds(cohost, host, 'cohost', 'co', 1000);
    expect(asCo.matches[0]!.teams).toEqual(host.matches[0]!.teams);
  });

  it('a score is never silently discarded: tie in time keeps the settled one', () => {
    const r0 = base();
    const id = r0.matches[0]!.id;
    let host = setMatchScore(r0, id, { teamIndex: 0, value: 21, mode: 'set' }, plugin, spec, 'host', 500);
    host = completeMatch(host, id, plugin, spec, 'host', 500);
    const cohost = setMatchScore(r0, id, { teamIndex: 0, value: 21, mode: 'set' }, plugin, spec, 'co', 500);
    const merged = mergeRounds(cohost, host, 'cohost', 'co', 600);
    expect(merged.matches[0]!.status).toBe('completed');
  });

  it('derives round status from merged matches', () => {
    const r0 = base();
    let host = r0;
    let cohost = r0;
    for (const [i, m] of r0.matches.entries()) {
      const target = i === 0 ? 'host' : 'co';
      const apply = (r: RoundDoc) => {
        let x = setMatchScore(r, m.id, { teamIndex: 0, value: 21, mode: 'set' }, plugin, spec, target, 10 + i);
        x = setMatchScore(x, m.id, { teamIndex: 1, value: 3, mode: 'set' }, plugin, spec, target, 11 + i);
        return completeMatch(x, m.id, plugin, spec, target, 12 + i);
      };
      if (i === 0) host = apply(host);
      else cohost = apply(cohost);
    }
    const merged = mergeRounds(host, cohost, 'host', 'host', 100);
    expect(merged.status).toBe('completed');
  });

  it('changedMatchIds reports score changes', () => {
    const r0 = base();
    const r1 = setMatchScore(r0, r0.matches[1]!.id, { teamIndex: 0, value: 3, mode: 'set' }, plugin, spec, 'h', 5);
    expect(changedMatchIds(r0, r1)).toEqual([r0.matches[1]!.id]);
  });
});
