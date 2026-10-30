/**
 * Mexicano pairing strategy — ranks-driven pairing.
 * Top vs bottom within groups of 4. Keeps matches competitive as the evening progresses.
 * See docs/implementation_be.md §6.2.6.
 */

import type { Id } from '@/types/common';
import type { MatchShape } from '@/types/sport';
import type { CourtDef } from '@/types/session';
import type { Match } from '@/types/round';
import type { StandingRow } from './types';
import { createId } from '@/core/utils/id';

/**
 * Assign players to courts by current standings rank.
 * For doubles (2×2): groups of 4, pairing rank1+rank4 vs rank2+rank3.
 * For singles (2×1): ladder pairing rank1 vs rank2, rank3 vs rank4, etc.
 * For Mahjong (4×1): groups of 4 at one table each.
 * Falls back to sequential order if standings unavailable (round 1).
 */
export function mexicanoAssign(
  playing: Id[],
  standings: StandingRow[] | undefined,
  courts: CourtDef[],
  shape: MatchShape,
  locks?: Array<{ playerId: Id; courtId: Id; teamIndex: number }>,
): Match[] {
  const activeCourts = courts.filter((c) => c.isActive);
  const perMatch = shape.teamsPerMatch * shape.playersPerTeam;

  // Sort players by standings rank (1 = best)
  let ranked: Id[];
  if (standings && standings.length > 0) {
    const standingMap = new Map(standings.map((s) => [s.playerId, s.rank]));
    ranked = [...playing].sort((a, b) => {
      const ra = standingMap.get(a) ?? 9999;
      const rb = standingMap.get(b) ?? 9999;
      return ra - rb;
    });
  } else {
    // Round 1: no standings yet — use the given order (will be seeded-shuffled by caller)
    ranked = [...playing];
  }

  const matches: Match[] = [];

  for (let i = 0; i < activeCourts.length; i++) {
    const court = activeCourts[i]!;
    const group = ranked.slice(i * perMatch, (i + 1) * perMatch);
    if (group.length < perMatch) break;

    let teams: Id[][];

    if (shape.teamsPerMatch === 2 && shape.playersPerTeam === 2) {
      // 1+4 vs 2+3 pairing
      teams = [
        [group[0]!, group[3]!],
        [group[1]!, group[2]!],
      ];
    } else if (shape.teamsPerMatch === 4 && shape.playersPerTeam === 1) {
      // Mahjong: 4 solo seats
      teams = group.map((p) => [p]);
    } else {
      // Singles or other: sequential split
      teams = [];
      for (let t = 0; t < shape.teamsPerMatch; t++) {
        teams.push(group.slice(t * shape.playersPerTeam, (t + 1) * shape.playersPerTeam));
      }
    }

    // Apply locks — override specific team slots
    if (locks) {
      for (const lock of locks) {
        if (lock.courtId === court.id) {
          const currentTeam = teams[lock.teamIndex];
          if (currentTeam) {
            // Replace the first available (non-locked) slot with the locked player
            const lockedIdx = currentTeam.indexOf(lock.playerId);
            if (lockedIdx === -1) {
              currentTeam[0] = lock.playerId;
            }
          }
        }
      }
    }

    matches.push({
      id: createId(),
      courtId: court.id,
      status: 'scheduled',
      teams,
      score: { points: new Array(shape.teamsPerMatch).fill(0) as number[], isComplete: false, winnerTeamIndex: null },
      startedAt: null,
      completedAt: null,
      manuallyEdited: false,
    });
  }

  return matches;
}
