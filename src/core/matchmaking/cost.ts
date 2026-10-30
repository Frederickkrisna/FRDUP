/**
 * Cost function for round quality evaluation.
 * Squaring penalties makes repeated pairings progressively more expensive.
 * See docs/implementation_be.md §6.2.4.
 */

import type { Id } from '@/types/common';
import type { HistoryMatrix, CostWeights } from './types';

/** Cost of a single match — repeat partners and opponents. */
export function costOfMatch(
  teams: Id[][],
  history: HistoryMatrix,
  weights: CostWeights,
): number {
  let cost = 0;

  // Repeat-partner penalty (squared): within each team
  for (const team of teams) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const a = team[i]!;
        const b = team[j]!;
        const count = history.partner[a]?.[b] ?? 0;
        cost += weights.repeatPartner * count * count;
      }
    }
  }

  // Repeat-opponent penalty (squared): across teams
  for (let t1 = 0; t1 < teams.length; t1++) {
    for (let t2 = t1 + 1; t2 < teams.length; t2++) {
      for (const a of teams[t1]!) {
        for (const b of teams[t2]!) {
          const count = history.opponent[a]?.[b] ?? 0;
          cost += weights.repeatOpponent * count * count;
        }
      }
    }
  }

  // Skill imbalance (off by default)
  if (weights.skillImbalance > 0) {
    cost += weights.skillImbalance * teamRpSpread(teams);
  }

  return cost;
}

/** Cost of a full round — match costs + match-count variance. */
export function costOfRound(
  matches: Array<{ teams: Id[][] }>,
  playing: Id[],
  history: HistoryMatrix,
  weights: CostWeights,
): number {
  let cost = 0;

  for (const match of matches) {
    cost += costOfMatch(match.teams, history, weights);
  }

  // Match-count imbalance penalty: discourage anyone falling far behind
  const counts = playing.map((id) => history.matchesPlayed[id] ?? 0);
  if (counts.length > 1) {
    const mean = counts.reduce((s, c) => s + c, 0) / counts.length;
    const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length;
    cost += weights.matchCountImbalance * variance;
  }

  return cost;
}

/**
 * Marginal cost of adding `candidate` to an in-progress match group `taken`.
 * Used to greedily fill a court during construction.
 */
export function marginalCost(
  taken: Id[],
  candidate: Id,
  currentTeamIndex: number,
  playersPerTeam: number,
  history: HistoryMatrix,
  weights: CostWeights,
): number {
  let cost = 0;

  for (let i = 0; i < taken.length; i++) {
    const other = taken[i]!;
    const sameTeam = Math.floor(i / playersPerTeam) === currentTeamIndex;

    if (sameTeam) {
      // Will be a partner
      const count = history.partner[candidate]?.[other] ?? 0;
      cost += weights.repeatPartner * count * count;
    } else {
      // Will be an opponent
      const count = history.opponent[candidate]?.[other] ?? 0;
      cost += weights.repeatOpponent * count * count;
    }
  }

  return cost;
}

/** RP spread across teams — proxy for skill imbalance. Lower is more balanced. */
function teamRpSpread(teams: Id[][]): number {
  // Without actual RP data here, we return 0 (feature toggled off by default weight=0)
  void teams;
  return 0;
}

/**
 * Find the best 2v2 (or NvM) split for `taken` players.
 * Exhaustive for perMatch ≤ 4, cheap enough.
 */
export function bestSplit(
  taken: Id[],
  teamsPerMatch: number,
  playersPerTeam: number,
  history: HistoryMatrix,
  weights: CostWeights,
): Id[][] {
  if (teamsPerMatch === 4 && playersPerTeam === 1) {
    // Mahjong: one player per team, no split needed
    return taken.map((p) => [p]);
  }

  if (teamsPerMatch === 2 && playersPerTeam === 1) {
    // Singles: only one way to split 2 players into 2 teams of 1
    return [[taken[0]!], [taken[1]!]];
  }

  if (teamsPerMatch === 2 && playersPerTeam === 2) {
    // Doubles: 3 ways to split 4 players into 2 teams of 2
    const [a, b, c, d] = taken as [Id, Id, Id, Id];
    const splits: Id[][][] = [
      [[a, b], [c, d]],
      [[a, c], [b, d]],
      [[a, d], [b, c]],
    ];
    let bestCost = Infinity;
    let best = splits[0]!;
    for (const split of splits) {
      const c = costOfMatch(split, history, weights);
      if (c < bestCost) {
        bestCost = c;
        best = split;
      }
    }
    return best;
  }

  // Fallback: assign sequentially
  const teams: Id[][] = [];
  for (let t = 0; t < teamsPerMatch; t++) {
    teams.push(taken.slice(t * playersPerTeam, (t + 1) * playersPerTeam));
  }
  return teams;
}
