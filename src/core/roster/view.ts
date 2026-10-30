/** Roster list view-model: search, archive filter and sorting. Pure and unit-tested. */

import type { RosterPlayerDoc } from '@/types/player';
import type { SportId } from '@/types/sport';

export type RosterSort = 'name' | 'lastPlayed' | 'tier';

const collator = new Intl.Collator('id', { sensitivity: 'base', numeric: true });

function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function filterPlayers(
  players: readonly RosterPlayerDoc[],
  opts: { query: string; showArchived: boolean },
): RosterPlayerDoc[] {
  const q = fold(opts.query.trim());
  return players.filter((p) => {
    if (!opts.showArchived && p.archivedAt !== null) return false;
    if (q === '') return true;
    return fold(p.name).includes(q) || fold(p.nickname ?? '').includes(q);
  });
}

function lastPlayed(p: RosterPlayerDoc, sportId: SportId | null): number {
  const sums = sportId ? [p.summary[sportId]] : Object.values(p.summary);
  return Math.max(-1, ...sums.map((s) => s?.lastPlayedAt ?? -1));
}

function rp(p: RosterPlayerDoc, sportId: SportId | null): number {
  const sums = sportId ? [p.summary[sportId]] : Object.values(p.summary);
  return Math.max(-1, ...sums.map((s) => s?.rp ?? -1));
}

/** Stable sort; ties fall back to name so the order never jumps around. */
export function sortPlayers(players: readonly RosterPlayerDoc[], sort: RosterSort, sportId: SportId | null): RosterPlayerDoc[] {
  const byName = (a: RosterPlayerDoc, b: RosterPlayerDoc) => collator.compare(a.name, b.name);
  const list = [...players];
  if (sort === 'name') return list.sort(byName);
  if (sort === 'lastPlayed') return list.sort((a, b) => lastPlayed(b, sportId) - lastPlayed(a, sportId) || byName(a, b));
  return list.sort((a, b) => rp(b, sportId) - rp(a, sportId) || byName(a, b));
}
