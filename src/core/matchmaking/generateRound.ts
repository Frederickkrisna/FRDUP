/**
 * Round generator — randomised greedy construction + hill climbing.
 * K=24 candidate constructions, then hill climbing for up to 2000 iterations / 40ms.
 * See docs/implementation_be.md §6.2.5.
 */

import type { Id } from '@/types/common';
import type { Match, RoundDoc } from '@/types/round';
import type { GenerateRoundInput, GenerateRoundOutput, CostWeights } from './types';
import { DEFAULT_COST_WEIGHTS } from './types';
import { seededRandom, shuffle } from './seededRandom';
import { selectResters } from './restQueue';
import { costOfRound, marginalCost, bestSplit } from './cost';
import { mexicanoAssign } from './mexicano';
import { createId } from '@/core/utils/id';
import { InsufficientPlayersError } from './errors';

const K_CANDIDATES = 24;
const MAX_ITERATIONS = 2000;
const BUDGET_MS = 40;

export function generateRound(input: GenerateRoundInput): GenerateRoundOutput {
  const weights: CostWeights = input.weights ?? DEFAULT_COST_WEIGHTS;
  const rng = seededRandom(input.seed);
  const shape = input.shape;
  const perMatch = shape.teamsPerMatch * shape.playersPerTeam;

  const activeCourts = input.courts.filter((c) => c.isActive);

  const { playing, resting } = selectResters(
    input.eligiblePlayerIds,
    shape,
    activeCourts.length,
    input.history,
    input.roundNumber,
    rng,
  );

  // Mexicano delegates to a different algorithm
  if (input.strategy === 'mexicano') {
    const matches = mexicanoAssign(playing, input.standings, activeCourts, shape, input.locks);
    const cost = costOfRound(matches, playing, input.history, weights);
    return { matches, restingPlayerIds: resting, cost, iterations: 0 };
  }

  // ---------- Phase A: K randomised greedy constructions ----------
  let best: { matches: Match[]; cost: number } | null = null;

  for (let attempt = 0; attempt < K_CANDIDATES; attempt++) {
    const pool = shuffle([...playing], rng);

    // Pin locked players first
    if (input.locks && input.locks.length > 0) {
      applyLocksToPool(pool, input.locks, activeCourts, shape);
    }

    const matches: Match[] = [];

    for (let ci = 0; ci < activeCourts.length; ci++) {
      const court = activeCourts[ci]!;
      if (pool.length < perMatch) break;

      // Find the seed player: the one who has played the fewest matches
      const seedIdx = findMinMatchIdx(pool, input.history);
      const taken: Id[] = [pool[seedIdx]!];
      pool.splice(seedIdx, 1);

      // Fill greedily by marginal cost + jitter
      while (taken.length < perMatch && pool.length > 0) {
        const currentTeamIndex = Math.floor(taken.length / shape.playersPerTeam);
        let bestIdx = 0;
        let bestCost = Infinity;
        for (let pi = 0; pi < pool.length; pi++) {
          const c =
            marginalCost(taken, pool[pi]!, currentTeamIndex, shape.playersPerTeam, input.history, weights) +
            rng.jitter();
          if (c < bestCost) {
            bestCost = c;
            bestIdx = pi;
          }
        }
        taken.push(pool[bestIdx]!);
        pool.splice(bestIdx, 1);
      }

      // Best team split (exhaustive for ≤4 players)
      const teams = bestSplit(taken, shape.teamsPerMatch, shape.playersPerTeam, input.history, weights);

      matches.push({
        id: createId(),
        courtId: court.id,
        status: 'scheduled',
        teams,
        score: {
          points: new Array(shape.teamsPerMatch).fill(0) as number[],
          isComplete: false,
          winnerTeamIndex: null,
        },
        startedAt: null,
        completedAt: null,
        manuallyEdited: false,
      });
    }

    const cost = costOfRound(matches, playing, input.history, weights);
    if (best === null || cost < best.cost) {
      best = { matches, cost };
    }
  }

  if (!best) {
    throw new InsufficientPlayersError(perMatch, playing.length);
  }

  // ---------- Phase B: Hill climbing ----------
  let current = best;
  let iterations = 0;
  const start = Date.now();

  while (iterations < MAX_ITERATIONS && Date.now() - start < BUDGET_MS) {
    iterations++;

    const move = rng.pick(['swapAcross', 'swapWithin'] as const);
    const candidate = applyMove(current.matches, move, resting, input.locks, rng, shape, weights, input.history);
    if (candidate === null) continue;

    const cc = costOfRound(candidate, playing, input.history, weights);
    if (cc < current.cost) {
      current = { matches: candidate, cost: cc };
    }
  }

  return {
    matches: current.matches,
    restingPlayerIds: resting,
    cost: current.cost,
    iterations,
  };
}

// ---- helpers ----

function findMinMatchIdx(pool: Id[], history: { matchesPlayed: Record<Id, number> }): number {
  let minPlayed = Infinity;
  let minIdx = 0;
  for (let i = 0; i < pool.length; i++) {
    const played = history.matchesPlayed[pool[i]!] ?? 0;
    if (played < minPlayed) {
      minPlayed = played;
      minIdx = i;
    }
  }
  return minIdx;
}

function applyLocksToPool(
  pool: Id[],
  locks: Array<{ playerId: Id; courtId: Id; teamIndex: number }>,
  courts: Array<{ id: Id }>,
  _shape: { teamsPerMatch: number; playersPerTeam: number },
): void {
  // Move locked players to the front of the pool in court/team order
  const lockedIds = new Set(locks.map((l) => l.playerId));
  const nonLocked = pool.filter((id) => !lockedIds.has(id));
  const lockedOrdered = locks
    .slice()
    .sort((a, b) => {
      const ci = courts.findIndex((c) => c.id === a.courtId);
      const cj = courts.findIndex((c) => c.id === b.courtId);
      if (ci !== cj) return ci - cj;
      return a.teamIndex - b.teamIndex;
    })
    .map((l) => l.playerId)
    .filter((id) => pool.includes(id));

  pool.splice(0, pool.length, ...lockedOrdered, ...nonLocked);
}

type MoveType = 'swapAcross' | 'swapWithin';

function applyMove(
  matches: Match[],
  move: MoveType,
  resting: Id[],
  locks: Array<{ playerId: Id; courtId: Id; teamIndex: number }> | undefined,
  rng: ReturnType<typeof seededRandom>,
  _shape: { teamsPerMatch: number; playersPerTeam: number },
  _weights: CostWeights,
  _history: { partner: Record<Id, Record<Id, number>>; opponent: Record<Id, Record<Id, number>>; matchesPlayed: Record<Id, number>; restCount: Record<Id, number>; lastRestedRound: Record<Id, number> },
): Match[] | null {
  if (matches.length === 0) return null;

  const lockedIds = new Set((locks ?? []).map((l) => l.playerId));

  // Deep-copy matches
  const cloned: Match[] = matches.map((m) => ({
    ...m,
    teams: m.teams.map((t) => [...t]),
  }));

  if (move === 'swapWithin' && cloned.length > 0) {
    // Swap two players between teams within one match
    const mi = rng.nextInt(cloned.length);
    const match = cloned[mi]!;
    if (match.teams.length < 2) return null;

    const t1 = rng.nextInt(match.teams.length);
    let t2 = rng.nextInt(match.teams.length - 1);
    if (t2 >= t1) t2++;

    if (!match.teams[t1] || !match.teams[t2]) return null;
    const p1i = rng.nextInt(match.teams[t1]!.length);
    const p2i = rng.nextInt(match.teams[t2]!.length);

    const p1 = match.teams[t1]![p1i]!;
    const p2 = match.teams[t2]![p2i]!;

    if (lockedIds.has(p1) || lockedIds.has(p2)) return null;

    match.teams[t1]![p1i] = p2;
    match.teams[t2]![p2i] = p1;
    return cloned;
  }

  if (move === 'swapAcross' && cloned.length >= 2) {
    // Swap a player between two different courts
    const mi1 = rng.nextInt(cloned.length);
    let mi2 = rng.nextInt(cloned.length - 1);
    if (mi2 >= mi1) mi2++;

    const m1 = cloned[mi1]!;
    const m2 = cloned[mi2]!;

    const t1 = rng.nextInt(m1.teams.length);
    const t2 = rng.nextInt(m2.teams.length);
    if (!m1.teams[t1] || !m2.teams[t2]) return null;

    const p1i = rng.nextInt(m1.teams[t1]!.length);
    const p2i = rng.nextInt(m2.teams[t2]!.length);

    const p1 = m1.teams[t1]![p1i]!;
    const p2 = m2.teams[t2]![p2i]!;

    if (lockedIds.has(p1) || lockedIds.has(p2)) return null;

    m1.teams[t1]![p1i] = p2;
    m2.teams[t2]![p2i] = p1;
    return cloned;
  }

  return null;
}

/**
 * Pure override: swap two players anywhere in the round (by id).
 * Used for manual host overrides. See docs/implementation_be.md §6.2.7.
 */
export function swapPlayers(round: RoundDoc, a: Id, b: Id): RoundDoc {
  const newMatches = round.matches.map((match) => {
    const newTeams = match.teams.map((team) =>
      team.map((pid) => {
        if (pid === a) return b;
        if (pid === b) return a;
        return pid;
      }),
    );

    const involved = match.teams.some((t) => t.includes(a) || t.includes(b));
    return { ...match, teams: newTeams, manuallyEdited: involved ? true : match.manuallyEdited };
  });

  const newResting = round.restingPlayerIds.map((pid) => {
    if (pid === a) return b;
    if (pid === b) return a;
    return pid;
  });

  return { ...round, matches: newMatches, restingPlayerIds: newResting };
}

/**
 * Pure override: replace one player with another (injury / late arrival).
 * See docs/implementation_be.md §6.2.7.
 */
export function substitutePlayer(
  round: RoundDoc,
  outId: Id,
  inId: Id,
): RoundDoc {
  return swapPlayers(round, outId, inId);
}
