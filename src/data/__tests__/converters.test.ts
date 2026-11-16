// @vitest-environment node
import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import type { RoundDoc } from '@/types/round';
import { decode, encode } from '../converters';

function hasNestedArray(v: unknown): boolean {
  if (Array.isArray(v)) return v.some((x) => Array.isArray(x) || hasNestedArray(x));
  if (v && typeof v === 'object' && !(v instanceof Timestamp)) return Object.values(v).some(hasNestedArray);
  return false;
}

const round: RoundDoc = {
  id: 'r1',
  schemaVersion: 1,
  sessionId: 's1',
  roundNumber: 1,
  status: 'in_progress',
  matches: [
    {
      id: 'm1',
      courtId: 'c1',
      status: 'in_progress',
      teams: [['a', 'b'], ['c', 'd']],
      score: { points: [3, 2], isComplete: false, winnerTeamIndex: null },
      startedAt: 1_700_000_000_000,
      completedAt: null,
      manuallyEdited: false,
    },
  ],
  restingPlayerIds: ['e'],
  generatedBy: 'auto',
  seed: 5,
  startedAt: 1_700_000_000_000,
  completedAt: null,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_500,
  lastWriterUid: 'u',
  revision: 3,
};

describe('Firestore wire conversion', () => {
  it('never emits an array nested inside an array (Firestore rejects them)', () => {
    expect(hasNestedArray(round)).toBe(true); // the domain shape IS nested…
    expect(hasNestedArray(encode(round))).toBe(false); // …the wire shape is not
  });

  it('round-trips a round document exactly, including 4-way mahjong teams', () => {
    expect(decode<RoundDoc>(encode(round))).toEqual(round);
    const four: RoundDoc = { ...round, matches: [{ ...round.matches[0]!, teams: [['a'], ['b'], ['c'], ['d']] }] };
    expect(decode<RoundDoc>(encode(four))).toEqual(four);
  });

  it('time fields become Timestamps on the wire and millis in the domain; null stays null', () => {
    const wire = encode(round) as { createdAt: unknown; matches: Array<{ startedAt: unknown; completedAt: unknown }> };
    expect(wire.createdAt).toBeInstanceOf(Timestamp);
    expect(wire.matches[0]?.startedAt).toBeInstanceOf(Timestamp);
    expect(wire.matches[0]?.completedAt).toBeNull();
  });

  it('drops undefined values (Firestore rejects them)', () => {
    expect(encode({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('converts PublicBoardDoc timestamps and nested entries properly', () => {
    const board = {
      id: 'b1',
      hostId: 'h1',
      sessionId: 's1',
      sportId: 'badminton',
      title: 'Friday Night Padel',
      venue: 'Kemang',
      playedAt: 1_700_000_000_000,
      entries: [
        {
          playerId: 'p1',
          name: 'Fred',
          nickname: null,
          avatarColor: '#10b981',
          rank: 1,
          matchesPlayed: 5,
          wins: 4,
          pointsFor: 50,
          pointsAgainst: 30,
          pointDiff: 20,
          winRate: 0.8,
          rpDelta: 25,
          tierAfter: 'gold',
          divisionAfter: 1,
        },
      ],
      createdAt: 1_700_000_000_000,
      expiresAt: 1_700_000_000_000 + 30 * 24 * 60 * 60 * 1000,
    };
    const wire = encode(board) as { createdAt: unknown; expiresAt: unknown; playedAt: unknown };
    expect(wire.createdAt).toBeInstanceOf(Timestamp);
    expect(wire.expiresAt).toBeInstanceOf(Timestamp);
    expect(wire.playedAt).toBeInstanceOf(Timestamp);
    expect(decode(encode(board))).toEqual(board);
  });
});
