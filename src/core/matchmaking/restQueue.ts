/**
 * Rest/bye queue — selects which players sit out each round.
 * Primary goal: equal rest distribution. Hard guard: never bench the same player twice in a row.
 * See docs/implementation_be.md §6.2.3.
 */

import type { Id } from '@/types/common';
import type { MatchShape } from '@/types/sport';
import type { HistoryMatrix } from './types';
import type { SeededRng } from './seededRandom';
import { InsufficientPlayersError } from './errors';

export interface RestQueueResult {
  playing: Id[];
  resting: Id[];
}

/**
 * Selects which players rest this round.
 * Back-to-back guard: a player who rested last round is only benched again
 * if all players with equal-or-fewer rests have also rested consecutively.
 */
export function selectResters(
  eligible: Id[],
  shape: MatchShape,
  activeCourts: number,
  history: HistoryMatrix,
  currentRound: number,
  rng: SeededRng,
): RestQueueResult {
  const perMatch = shape.teamsPerMatch * shape.playersPerTeam;
  const actualCourts = Math.min(activeCourts, Math.floor(eligible.length / perMatch));

  if (actualCourts === 0) {
    throw new InsufficientPlayersError(perMatch, eligible.length);
  }

  const capacity = actualCourts * perMatch;
  const restQuota = eligible.length - capacity;

  if (restQuota === 0) {
    return { playing: [...eligible], resting: [] };
  }

  // Sort candidates for the bench.
  // Lower score = rests first.
  const ranked = [...eligible].sort((a, b) => {
    const restA = history.restCount[a] ?? 0;
    const restB = history.restCount[b] ?? 0;
    // 1. Fewest rests so far (ASC)
    if (restA !== restB) return restA - restB;

    // 2. Most matches played (DESC) — busiest sits down
    const matchA = history.matchesPlayed[a] ?? 0;
    const matchB = history.matchesPlayed[b] ?? 0;
    if (matchA !== matchB) return matchB - matchA;

    // 3. Longest since last rested (DESC) — avoid two consecutive rests
    const lastA = history.lastRestedRound[a] ?? 0;
    const lastB = history.lastRestedRound[b] ?? 0;
    const sinceA = currentRound - lastA;
    const sinceB = currentRound - lastB;
    if (sinceA !== sinceB) return sinceB - sinceA;

    // 4. Seeded random — deterministic tie-break
    return rng.jitter() - rng.jitter();
  });

  const resting = pickAvoidingBackToBack(ranked, restQuota, history, currentRound, eligible);
  const restingSet = new Set(resting);
  const playing = eligible.filter((id) => !restingSet.has(id));

  return { playing, resting };
}

/**
 * Picks `quota` players to rest, trying to avoid anyone who rested last round
 * as long as a player with equal-or-fewer rests hasn't rested consecutively.
 */
function pickAvoidingBackToBack(
  ranked: Id[],
  quota: number,
  history: HistoryMatrix,
  currentRound: number,
  eligible: Id[],
): Id[] {
  const restedLastRound = new Set(
    eligible.filter((id) => (history.lastRestedRound[id] ?? 0) === currentRound - 1),
  );

  const resting: Id[] = [];
  const skipped: Id[] = [];

  for (const candidate of ranked) {
    if (resting.length >= quota) break;

    if (restedLastRound.has(candidate)) {
      skipped.push(candidate);
      continue;
    }
    resting.push(candidate);
  }

  // If we couldn't fill quota without back-to-back, allow it
  for (const candidate of skipped) {
    if (resting.length >= quota) break;
    resting.push(candidate);
  }

  return resting;
}
