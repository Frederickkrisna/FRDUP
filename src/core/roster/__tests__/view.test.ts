import { describe, expect, it } from 'vitest';
import type { RosterPlayerDoc } from '@/types/player';
import { filterPlayers, sortPlayers } from '../view';

const p = (name: string, extra: Partial<RosterPlayerDoc> = {}): RosterPlayerDoc => ({
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
  summary: {},
  ...extra,
});

const sum = (rp: number, lastPlayedAt: number | null) => ({
  tier: 'warrior' as const,
  division: 3,
  stars: 0,
  rp,
  matchesPlayed: 1,
  wins: 1,
  sessionsPlayed: 1,
  lastPlayedAt,
});

describe('roster view', () => {
  const list = [
    p('Budi', { summary: { badminton: sum(120, 100) } }),
    p('andi', { summary: { badminton: sum(900, 50) } }),
    p('Éka', { nickname: 'Eka Putra', archivedAt: 5 }),
    p('Citra'),
  ];

  it('hides archived by default and shows them on request', () => {
    expect(filterPlayers(list, { query: '', showArchived: false }).map((x) => x.name)).toEqual(['Budi', 'andi', 'Citra']);
    expect(filterPlayers(list, { query: '', showArchived: true })).toHaveLength(4);
  });

  it('search is case- and accent-insensitive and matches nicknames', () => {
    expect(filterPlayers(list, { query: 'EKA', showArchived: true }).map((x) => x.name)).toEqual(['Éka']);
    expect(filterPlayers(list, { query: 'putra', showArchived: true })).toHaveLength(1);
    expect(filterPlayers(list, { query: 'zzz', showArchived: true })).toEqual([]);
  });

  it('sorts by name ignoring case', () => {
    expect(sortPlayers(list, 'name', null).map((x) => x.name)).toEqual(['andi', 'Budi', 'Citra', 'Éka']);
  });

  it('sorts by tier (rp) per sport, unranked last, ties by name', () => {
    expect(sortPlayers(list, 'tier', 'badminton').map((x) => x.name)).toEqual(['andi', 'Budi', 'Citra', 'Éka']);
    expect(sortPlayers(list, 'tier', 'padel').map((x) => x.name)).toEqual(['andi', 'Budi', 'Citra', 'Éka']);
  });

  it('sorts by last played, never-played last', () => {
    expect(sortPlayers(list, 'lastPlayed', 'badminton').map((x) => x.name)).toEqual(['Budi', 'andi', 'Citra', 'Éka']);
  });

  it('does not mutate its input', () => {
    const copy = [...list];
    sortPlayers(list, 'name', null);
    expect(list).toEqual(copy);
  });
});
