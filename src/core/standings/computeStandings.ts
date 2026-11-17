/**
 * computeStandings — aggregates completed match results into a ranked leaderboard.
 * Pure function: no side effects, deterministic given the same inputs.
 * See docs/api_contract.md §5.1.
 */

import type { Id } from '@/types/common';
import type { SessionParticipant } from '@/types/session';
import type { RoundDoc, CompletedMatch } from '@/types/round';
import type { SportPlugin, ScoreInputSpec } from '@/types/sport';
import type { StandingRow } from '@/core/matchmaking/types';

type SortField = SportPlugin['standingsSort'][number]['field'];

/** Points a row ranks on: points scored plus the +M compensation for missed matches. */
export function standingPoints(row: Pick<StandingRow, 'pointsFor' | 'compensation'>): number {
  return row.pointsFor + row.compensation;
}

/** points means standingPoints; the other fields map 1:1 onto StandingRow. */
function sortValue(row: StandingRow, field: SortField): number {
  return field === 'points' ? standingPoints(row) : row[field];
}

/** Build initial per-player accumulators. */
function emptyRow(playerId: Id): Omit<StandingRow, 'rank' | 'winRate' | 'compensation'> {
  return {
    playerId,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDiff: 0,
    restCount: 0,
  };
}

/**
 * Compute session standings from all completed rounds.
 * Respects joinedAtRound / leftAtRound windows on participants.
 */
export function computeStandings(
  participants: SessionParticipant[],
  rounds: RoundDoc[],
  plugin: SportPlugin,
  spec: ScoreInputSpec,
): StandingRow[] {
  const acc = new Map<Id, ReturnType<typeof emptyRow>>();

  for (const p of participants) {
    acc.set(p.playerId, emptyRow(p.playerId));
  }

  for (const round of rounds) {
    if (round.status === 'scheduled') continue;

    // Rest counts
    for (const restId of round.restingPlayerIds) {
      const row = acc.get(restId);
      if (row) row.restCount++;
    }

    for (const match of round.matches) {
      if (match.status !== 'completed') continue;

      // Cast to CompletedMatch — status is checked above
      const completed = match as CompletedMatch;
      const deltas = plugin.toPlayerDeltas(completed, spec);

      for (const delta of deltas) {
        const row = acc.get(delta.playerId);
        if (!row) continue;

        row.matchesPlayed++;
        row.pointsFor += delta.pointsFor;
        row.pointsAgainst += delta.pointsAgainst;
        row.pointDiff += delta.pointsFor - delta.pointsAgainst;

        if (delta.won) row.wins++;
        else if (delta.drew) row.draws++;
        else row.losses++;
      }
    }
  }

  // +M: when the rotation leaves someone with fewer matches, credit each missed match at that
  // player's own average, so a points ranking compares like with like. Wins-first sports skip it.
  const compensate = plugin.standingsSort[0]?.field === 'points';
  let maxPlayed = 0;
  for (const r of acc.values()) maxPlayed = Math.max(maxPlayed, r.matchesPlayed);

  // Build rows array with winRate
  const rows: StandingRow[] = Array.from(acc.values()).map((r) => ({
    ...r,
    winRate: r.matchesPlayed > 0 ? r.wins / r.matchesPlayed : 0,
    compensation: compensate && r.matchesPlayed > 0 ? Math.round((r.pointsFor / r.matchesPlayed) * (maxPlayed - r.matchesPlayed)) : 0,
    rank: 0, // set below
  }));

  // Sort per plugin.standingsSort
  rows.sort((a, b) => {
    for (const { field, dir } of plugin.standingsSort) {
      const va = sortValue(a, field);
      const vb = sortValue(b, field);
      if (va !== vb) {
        return dir === 'desc' ? vb - va : va - vb;
      }
    }
    // Stable tiebreak: alphabetical by playerId
    return a.playerId.localeCompare(b.playerId);
  });

  // Assign ranks (dense ranking — ties share rank, next rank skips)
  let currentRank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) {
      const prev = rows[i - 1]!;
      const curr = rows[i]!;
      let tied = true;
      for (const { field } of plugin.standingsSort) {
        const vp = sortValue(prev, field);
        const vc = sortValue(curr, field);
        if (vp !== vc) { tied = false; break; }
      }
      if (!tied) currentRank = i + 1;
    }
    rows[i]!.rank = currentRank;
  }

  return rows;
}
