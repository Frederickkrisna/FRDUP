/** All-time leaderboard for one sport, derived from roster summaries (no fan-out reads). */

import type { Id } from '@/types/common';
import type { PlayerSportSummary, RosterPlayerDoc } from '@/types/player';
import type { SportId } from '@/types/sport';

export interface AllTimeRow {
  rank: number;
  playerId: Id;
  name: string;
  nickname: string | null;
  avatarColor: string;
  avatarUrl: string | null;
  summary: PlayerSportSummary;
  winRate: number;
}

/**
 * Ranked by RP, then wins, then matches played, then name. Players tied on RP and wins share a
 * rank. Guests and players who never played the sport are excluded.
 */
export function allTimeRows(players: readonly RosterPlayerDoc[], sportId: SportId): AllTimeRow[] {
  const rows = players
    .filter((p) => !p.isGuest && p.archivedAt === null)
    .flatMap((p) => {
      const s = p.summary[sportId];
      return s && s.matchesPlayed > 0
        ? [{ player: p, summary: s, winRate: s.matchesPlayed > 0 ? s.wins / s.matchesPlayed : 0 }]
        : [];
    })
    .sort(
      (a, b) =>
        b.summary.rp - a.summary.rp ||
        b.summary.wins - a.summary.wins ||
        b.summary.matchesPlayed - a.summary.matchesPlayed ||
        a.player.name.localeCompare(b.player.name, 'id'),
    );

  let rank = 0;
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    if (!prev || prev.summary.rp !== r.summary.rp || prev.summary.wins !== r.summary.wins) rank = i + 1;
    return {
      rank,
      playerId: r.player.id,
      name: r.player.name,
      nickname: r.player.nickname,
      avatarColor: r.player.avatarColor,
      avatarUrl: r.player.avatarUrl ?? null,
      summary: r.summary,
      winRate: r.winRate,
    };
  });
}
