/** computeStandings tests — aggregation, ranking, rest tracking. */

import { describe, it, expect } from 'vitest';
import { computeStandings } from '../computeStandings';
import { padelPlugin } from '@/core/sports/padel';
import type { SessionParticipant } from '@/types/session';
import type { RoundDoc, Match } from '@/types/round';

const spec = padelPlugin.buildScoreInput({ fixedTotal: 21 });

function participant(id: string): SessionParticipant {
  return {
    playerId: id, name: id, nickname: null, avatarColor: '#fff',
    isGuest: false, joinedAtRound: 1, leftAtRound: null,
    includeInRanking: true, includeInBill: true,
  };
}

function completedMatch(
  id: string, courtId: string,
  teams: string[][], points: [number, number],
): Match {
  const winner = points[0] > points[1] ? 0 : points[1] > points[0] ? 1 : null;
  return {
    id, courtId, status: 'completed',
    teams: teams as string[][],
    score: { points, isComplete: true, winnerTeamIndex: winner },
    startedAt: null, completedAt: null, manuallyEdited: false,
  };
}

function round(
  roundNumber: number,
  matches: Match[],
  resting: string[] = [],
): RoundDoc {
  return {
    id: `r${roundNumber}`,
    schemaVersion: 1,
    sessionId: 's1',
    roundNumber,
    status: 'completed',
    matches,
    restingPlayerIds: resting,
    generatedBy: 'auto',
    seed: roundNumber,
    startedAt: null,
    completedAt: null,
    createdAt: 0,
    updatedAt: 0,
    lastWriterUid: 'host',
    revision: 1,
  };
}

describe('computeStandings', () => {
  it('empty rounds → all players at rank 1, 0 matches', () => {
    const participants = ['A', 'B', 'C', 'D'].map(participant);
    const rows = computeStandings(participants, [], padelPlugin, spec);
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.matchesPlayed).toBe(0);
      expect(row.wins).toBe(0);
    }
  });

  it('winner has higher pointsFor and wins=1', () => {
    const participants = ['A', 'B', 'C', 'D'].map(participant);
    const r1 = round(1, [
      completedMatch('m1', 'c1', [['A', 'B'], ['C', 'D']], [15, 6]),
    ]);
    const rows = computeStandings(participants, [r1], padelPlugin, spec);
    const a = rows.find((r) => r.playerId === 'A')!;
    const c = rows.find((r) => r.playerId === 'C')!;
    expect(a.wins).toBe(1);
    expect(a.pointsFor).toBe(15);
    expect(a.pointsAgainst).toBe(6);
    expect(c.wins).toBe(0);
    expect(c.losses).toBe(1);
  });

  it('rest count is tracked', () => {
    const participants = ['A', 'B', 'C', 'D', 'E'].map(participant);
    const r1 = round(1, [
      completedMatch('m1', 'c1', [['A', 'B'], ['C', 'D']], [15, 6]),
    ], ['E']);
    const rows = computeStandings(participants, [r1], padelPlugin, spec);
    const e = rows.find((r) => r.playerId === 'E')!;
    expect(e.restCount).toBe(1);
    expect(e.matchesPlayed).toBe(0);
  });

  it('standings sorted by points desc (padel)', () => {
    const participants = ['A', 'B', 'C', 'D'].map(participant);
    const r1 = round(1, [
      completedMatch('m1', 'c1', [['A', 'B'], ['C', 'D']], [15, 6]),
    ]);
    const r2 = round(2, [
      completedMatch('m2', 'c1', [['A', 'C'], ['B', 'D']], [18, 3]),
    ]);
    const rows = computeStandings(participants, [r1, r2], padelPlugin, spec);
    // A won both rounds with high scores
    expect(rows[0]!.playerId).toBe('A');
    expect(rows[0]!.rank).toBe(1);
  });

  it('rank 1 for everyone on 0 matches (tied)', () => {
    const participants = ['A', 'B'].map(participant);
    const rows = computeStandings(participants, [], padelPlugin, spec);
    expect(rows[0]!.rank).toBe(1);
    expect(rows[1]!.rank).toBe(1);
  });

  it('voided matches are not counted', () => {
    const participants = ['A', 'B', 'C', 'D'].map(participant);
    const voidedMatch: Match = {
      id: 'm1', courtId: 'c1', status: 'voided',
      teams: [['A', 'B'], ['C', 'D']],
      score: { points: [15, 6], isComplete: false, winnerTeamIndex: null },
      startedAt: null, completedAt: null, manuallyEdited: false,
    };
    const r1 = round(1, [voidedMatch]);
    const rows = computeStandings(participants, [r1], padelPlugin, spec);
    for (const row of rows) {
      expect(row.matchesPlayed).toBe(0);
    }
  });

  it('padel sorts by points scored first, before wins and diff', () => {
    // P: 1W 1L, 21 points, diff 0.  Q: 1W 0L, 11 points, diff +1.
    // Sorting by wins/diff alone would rank Q above P; the plugin says points come first.
    const participants = ['P', 'A', 'B', 'C', 'D', 'Q', 'E'].map(participant);
    const r1 = round(1, [completedMatch('m1', 'c1', [['P', 'A'], ['B', 'C']], [11, 10])]);
    const r2 = round(2, [completedMatch('m2', 'c1', [['P', 'D'], ['Q', 'E']], [10, 11])]);
    const rows = computeStandings(participants, [r1, r2], padelPlugin, spec);
    const rankOf = (id: string) => rows.find((r) => r.playerId === id)!.rank;
    expect(rows.every((r) => Number.isFinite(r.rank))).toBe(true);
    expect(rankOf('P')).toBeLessThan(rankOf('Q'));
  });

  it('winRate computed correctly', () => {
    const participants = ['A', 'B', 'C', 'D'].map(participant);
    const r1 = round(1, [completedMatch('m1', 'c1', [['A', 'B'], ['C', 'D']], [15, 6])]);
    const r2 = round(2, [completedMatch('m2', 'c1', [['A', 'B'], ['C', 'D']], [6, 15])]);
    const rows = computeStandings(participants, [r1, r2], padelPlugin, spec);
    const a = rows.find((r) => r.playerId === 'A')!;
    expect(a.matchesPlayed).toBe(2);
    expect(a.wins).toBe(1);
    expect(a.winRate).toBeCloseTo(0.5);
  });
});
