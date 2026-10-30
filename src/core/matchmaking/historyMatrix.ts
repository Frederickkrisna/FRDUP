/**
 * History matrix — tracks partner/opponent/rest counts across all completed rounds.
 * Built once on session hydration, updated incrementally as rounds complete.
 * See docs/implementation_be.md §6.2.2.
 */

import type { Id } from '@/types/common';
import type { RoundDoc } from '@/types/round';
import type { SessionParticipant } from '@/types/session';
import type { HistoryMatrix } from './types';

function ensurePlayer(matrix: HistoryMatrix, id: Id): void {
  if (!matrix.partner[id]) matrix.partner[id] = {};
  if (!matrix.opponent[id]) matrix.opponent[id] = {};
  if (matrix.restCount[id] === undefined) matrix.restCount[id] = 0;
  if (matrix.matchesPlayed[id] === undefined) matrix.matchesPlayed[id] = 0;
  if (matrix.lastRestedRound[id] === undefined) matrix.lastRestedRound[id] = 0;
}

function inc(record: Record<Id, Record<Id, number>>, a: Id, b: Id): void {
  record[a]![b] = (record[a]![b] ?? 0) + 1;
  record[b]![a] = (record[b]![a] ?? 0) + 1;
}

/** Builds the history matrix from scratch. O(rounds × playersPerMatch²). */
export function buildHistoryMatrix(
  participants: SessionParticipant[],
  rounds: RoundDoc[],
): HistoryMatrix {
  const matrix: HistoryMatrix = {
    partner: {},
    opponent: {},
    restCount: {},
    matchesPlayed: {},
    lastRestedRound: {},
  };

  // Seed every known participant so the matrix is complete even before round 1
  for (const p of participants) {
    ensurePlayer(matrix, p.playerId);
  }

  for (const round of rounds) {
    // Only consider completed or in-progress rounds
    if (round.status === 'scheduled') continue;

    // Record rest counts
    for (const restId of round.restingPlayerIds) {
      ensurePlayer(matrix, restId);
      matrix.restCount[restId] = (matrix.restCount[restId] ?? 0) + 1;
      matrix.lastRestedRound[restId] = round.roundNumber;
    }

    for (const match of round.matches) {
      if (match.status === 'voided') continue;

      const teams = match.teams;

      // Partner relationships (same team)
      for (const team of teams) {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            const a = team[i]!;
            const b = team[j]!;
            ensurePlayer(matrix, a);
            ensurePlayer(matrix, b);
            inc(matrix.partner, a, b);
          }
        }
        // Increment matchesPlayed for every player in the team
        for (const playerId of team) {
          ensurePlayer(matrix, playerId);
          matrix.matchesPlayed[playerId] = (matrix.matchesPlayed[playerId] ?? 0) + 1;
        }
      }

      // Opponent relationships (cross-team)
      // For Mahjong (4 teams of 1), everyone at the table is an "opponent"
      for (let t1 = 0; t1 < teams.length; t1++) {
        for (let t2 = t1 + 1; t2 < teams.length; t2++) {
          for (const a of teams[t1]!) {
            for (const b of teams[t2]!) {
              ensurePlayer(matrix, a);
              ensurePlayer(matrix, b);
              inc(matrix.opponent, a, b);
            }
          }
        }
      }
    }
  }

  return matrix;
}

/**
 * Incremental update: apply a single newly-completed round to an existing matrix.
 * Avoids rebuilding from scratch on every score entry.
 */
export function applyRoundToMatrix(matrix: HistoryMatrix, round: RoundDoc): HistoryMatrix {
  // Mutate a shallow copy to stay pure at the round level
  const updated: HistoryMatrix = {
    partner: { ...matrix.partner },
    opponent: { ...matrix.opponent },
    restCount: { ...matrix.restCount },
    matchesPlayed: { ...matrix.matchesPlayed },
    lastRestedRound: { ...matrix.lastRestedRound },
  };

  for (const restId of round.restingPlayerIds) {
    ensurePlayer(updated, restId);
    updated.restCount[restId] = (updated.restCount[restId] ?? 0) + 1;
    updated.lastRestedRound[restId] = round.roundNumber;
  }

  for (const match of round.matches) {
    if (match.status === 'voided') continue;
    const teams = match.teams;

    for (const team of teams) {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const a = team[i]!;
          const b = team[j]!;
          ensurePlayer(updated, a);
          ensurePlayer(updated, b);
          if (!updated.partner[a]) updated.partner[a] = {};
          if (!updated.partner[b]) updated.partner[b] = {};
          updated.partner[a]![b] = (updated.partner[a]![b] ?? 0) + 1;
          updated.partner[b]![a] = (updated.partner[b]![a] ?? 0) + 1;
        }
      }
      for (const playerId of team) {
        ensurePlayer(updated, playerId);
        updated.matchesPlayed[playerId] = (updated.matchesPlayed[playerId] ?? 0) + 1;
      }
    }

    for (let t1 = 0; t1 < teams.length; t1++) {
      for (let t2 = t1 + 1; t2 < teams.length; t2++) {
        for (const a of teams[t1]!) {
          for (const b of teams[t2]!) {
            ensurePlayer(updated, a);
            ensurePlayer(updated, b);
            if (!updated.opponent[a]) updated.opponent[a] = {};
            if (!updated.opponent[b]) updated.opponent[b] = {};
            updated.opponent[a]![b] = (updated.opponent[a]![b] ?? 0) + 1;
            updated.opponent[b]![a] = (updated.opponent[b]![a] ?? 0) + 1;
          }
        }
      }
    }
  }

  return updated;
}
