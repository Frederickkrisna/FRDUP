import { describe, expect, it } from 'vitest';
import type { PlayerSportSummary, RosterPlayerDoc } from '@/types/player';
import { allTimeRows } from '../allTime';

const sum = (rp: number, wins = 0, matches = 5): PlayerSportSummary => ({
  tier: 'warrior',
  division: 3,
  stars: 0,
  rp,
  matchesPlayed: matches,
  wins,
  sessionsPlayed: 1,
  lastPlayedAt: 1,
});

const p = (name: string, badminton?: PlayerSportSummary, extra: Partial<RosterPlayerDoc> = {}): RosterPlayerDoc => ({
  id: name,
  schemaVersion: 1,
  hostId: 'h',
  name,
  nickname: null,
  avatarUrl: null,
  avatarColor: '#000000',
  phone: null,
  notes: null,
  isGuest: false,
  archivedAt: null,
  createdAt: 0,
  updatedAt: 0,
  summary: badminton ? { badminton } : {},
  ...extra,
});

describe('allTimeRows', () => {
  it('ranks by RP then wins, excludes guests, archived and non-players', () => {
    const rows = allTimeRows(
      [p('Budi', sum(300, 3)), p('Sari', sum(900, 4)), p('Tamu', sum(2000, 9), { isGuest: true }), p('Lama', sum(500, 5), { archivedAt: 1 }), p('Baru'), p('Nol', sum(0, 0, 0))],
      'badminton',
    );
    expect(rows.map((r) => r.name)).toEqual(['Sari', 'Budi']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('ties on RP and wins share a rank; the next rank skips', () => {
    const rows = allTimeRows([p('A', sum(500, 4)), p('B', sum(500, 4)), p('C', sum(500, 2)), p('D', sum(100, 1))], 'badminton');
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3, 4]);
  });

  it('is empty for a sport nobody played', () => {
    expect(allTimeRows([p('A', sum(100))], 'padel')).toEqual([]);
  });

  it('win rate is safe and correct', () => {
    expect(allTimeRows([p('A', sum(100, 3, 4))], 'badminton')[0]?.winRate).toBe(0.75);
  });
});
