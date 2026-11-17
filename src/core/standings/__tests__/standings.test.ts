/** computeStandings tests — aggregation, ranking, rest tracking. */

import { describe, it, expect } from 'vitest';
import { computeStandings, standingPoints } from '../computeStandings';
import { badmintonPlugin } from '@/core/sports/badminton';
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
    // Both play twice (no +M). P: 0W 2L, 20 points.  Q: 1W 1L, 11 points.
    // Sorting by wins alone would rank Q above P; the plugin says points come first.
    const participants = ['P', 'A', 'B', 'C', 'D', 'Q', 'E', 'F'].map(participant);
    const r1 = round(1, [completedMatch('m1', 'c1', [['P', 'A'], ['Q', 'B']], [10, 11])]);
    const r2 = round(2, [
      completedMatch('m2', 'c1', [['P', 'C'], ['D', 'E']], [10, 11]),
      completedMatch('m3', 'c2', [['Q', 'A'], ['B', 'F']], [0, 21]),
    ]);
    const rows = computeStandings(participants, [r1, r2], padelPlugin, spec);
    const rankOf = (id: string) => rows.find((r) => r.playerId === id)!.rank;
    expect(rows.every((r) => Number.isFinite(r.rank))).toBe(true);
    expect(rows.find((r) => r.playerId === 'P')?.compensation).toBe(0);
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

describe('+M compensation (points-first sports)', () => {
  // E rests in round 2 and plays round 1 + 3; everyone else plays two of three.
  const participants = ['A', 'B', 'C', 'D', 'E'].map(participant);
  const rounds = [
    round(1, [completedMatch('m1', 'c1', [['A', 'B'], ['C', 'D']], [15, 6])], ['E']),
    round(2, [completedMatch('m2', 'c1', [['A', 'C'], ['B', 'E']], [10, 11])], ['D']),
    round(3, [completedMatch('m3', 'c1', [['A', 'D'], ['C', 'E']], [12, 9])], ['B']),
  ];

  it('credits each missed match at the player own average, and ranks on the total', () => {
    const rows = computeStandings(participants, rounds, padelPlugin, spec);
    const by = new Map(rows.map((r) => [r.playerId, r]));
    expect(by.get('A')?.compensation).toBe(0); // played all 3
    expect(by.get('B')?.compensation).toBe(13); // 15 + 11 in 2: avg 13, 1 missed
    expect(by.get('E')?.compensation).toBe(10); // 11 + 9 in 2: avg 10
    expect(by.get('C')?.compensation).toBe(0); // played all 3: 6 + 10 + 9
    expect(standingPoints(by.get('B') ?? { pointsFor: 0, compensation: 0 })).toBe(39);
    // B (26 + 13 = 39) passes A (15 + 10 + 12 = 37) only thanks to +M.
    expect(rows[0]?.playerId).toBe('B');
  });

  it('nobody is compensated when everyone played the same number of matches', () => {
    const rows = computeStandings(participants.slice(0, 4), [rounds[0] as RoundDoc], padelPlugin, spec);
    expect(rows.every((r) => r.compensation === 0)).toBe(true);
  });

  it('wins-first sports never compensate', () => {
    const bSpec = badmintonPlugin.buildScoreInput({});
    const rows = computeStandings(participants, rounds, badmintonPlugin, bSpec);
    expect(rows.every((r) => r.compensation === 0)).toBe(true);
  });
});
