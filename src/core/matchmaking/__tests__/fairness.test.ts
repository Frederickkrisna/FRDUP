/**
 * Matchmaking fairness property tests.
 * Simulates full sessions and asserts all invariants from implementation_be.md §6.2.8.
 * These are the most important tests in the codebase.
 */

import { describe, it, expect } from 'vitest';
import { generateRound, swapPlayers, substitutePlayer } from '../generateRound';
import { buildHistoryMatrix, applyRoundToMatrix } from '../historyMatrix';
import type { HistoryMatrix, GenerateRoundInput } from '../types';
import type { RoundDoc } from '@/types/round';
import type { SessionParticipant } from '@/types/session';
import type { CourtDef } from '@/types/session';

// ---- helpers ----

function makePlayers(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `P${i}`);
}

function makeParticipants(playerIds: string[]): SessionParticipant[] {
  return playerIds.map((id) => ({
    playerId: id,
    name: id,
    nickname: null,
    avatarColor: '#fff',
    isGuest: false,
    joinedAtRound: 1,
    leftAtRound: null,
    includeInRanking: true,
    includeInBill: true,
  }));
}

function makeCourts(n: number): CourtDef[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `C${i}`,
    index: i,
    label: `Court ${i + 1}`,
    isActive: true,
  }));
}

/** Run a full simulated session and return all generated rounds + final history. */
function simulateSession(
  playerCount: number,
  courtCount: number,
  roundCount: number,
  strategy: 'americano' | 'mexicano' = 'americano',
  playersPerTeam = 2,
): { rounds: RoundDoc[]; history: HistoryMatrix } {
  const playerIds = makePlayers(playerCount);
  const participants = makeParticipants(playerIds);
  const courts = makeCourts(courtCount);
  const shape = { teamsPerMatch: 2, playersPerTeam };

  let history = buildHistoryMatrix(participants, []);
  const rounds: RoundDoc[] = [];

  for (let r = 1; r <= roundCount; r++) {
    const input: GenerateRoundInput = {
      roundNumber: r,
      eligiblePlayerIds: playerIds,
      courts,
      shape,
      history,
      strategy,
      seed: r * 1337 + playerCount * 7 + courtCount * 13,
    };

    const output = generateRound(input);

    const round: RoundDoc = {
      id: `round-${r}`,
      schemaVersion: 1,
      sessionId: 'session-1',
      roundNumber: r,
      status: 'completed',
      matches: output.matches.map((m) => ({ ...m, status: 'completed' })),
      restingPlayerIds: output.restingPlayerIds,
      generatedBy: 'auto',
      seed: input.seed,
      startedAt: null,
      completedAt: null,
      createdAt: 0,
      updatedAt: 0,
      lastWriterUid: 'host',
      revision: 1,
    };

    rounds.push(round);
    history = applyRoundToMatrix(history, round);
  }

  return { rounds, history };
}

// ---- invariant checks ----

function checkNoduplicateInRound(round: RoundDoc): void {
  const seen = new Set<string>();
  for (const match of round.matches) {
    for (const team of match.teams) {
      for (const pid of team) {
        expect(seen.has(pid), `Duplicate player ${pid} in round ${round.roundNumber}`).toBe(false);
        seen.add(pid);
      }
    }
  }
  for (const pid of round.restingPlayerIds) {
    expect(seen.has(pid), `Resting player ${pid} also playing`).toBe(false);
    seen.add(pid);
  }
}

function checkRestFairness(history: HistoryMatrix, playerIds: string[]): void {
  const counts = playerIds.map((id) => history.restCount[id] ?? 0);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  expect(max - min, `Rest imbalance: max=${max}, min=${min}`).toBeLessThanOrEqual(1);
}

function checkMatchFairness(history: HistoryMatrix, playerIds: string[]): void {
  const counts = playerIds.map((id) => history.matchesPlayed[id] ?? 0);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  expect(max - min, `Match imbalance: max=${max}, min=${min}`).toBeLessThanOrEqual(1);
}

function checkNoStarvation(history: HistoryMatrix, playerIds: string[], rounds: number): void {
  for (const id of playerIds) {
    const played = history.matchesPlayed[id] ?? 0;
    expect(played, `Player ${id} played 0 matches over ${rounds} rounds`).toBeGreaterThanOrEqual(1);
  }
}

/** Extract just the structural info (teams + resting), not IDs which are random. */
function roundStructure(round: RoundDoc): string {
  const teams = round.matches.map((m) => m.teams.map((t) => [...t].sort()).sort());
  return JSON.stringify({ teams, resting: [...round.restingPlayerIds].sort() });
}

function checkDeterminism(playerCount: number, courtCount: number): void {
  const r1 = simulateSession(playerCount, courtCount, 6);
  const r2 = simulateSession(playerCount, courtCount, 6);

  for (let i = 0; i < r1.rounds.length; i++) {
    expect(roundStructure(r1.rounds[i]!)).toBe(roundStructure(r2.rounds[i]!));
  }
}

// ---- test cases ----

describe('matchmaking — no duplicate player per round', () => {
  const configs: [number, number][] = [
    [4, 1], [5, 1], [8, 2], [9, 2], [12, 3], [16, 4], [20, 5],
  ];

  for (const [n, c] of configs) {
    it(`${n} players, ${c} courts`, () => {
      const { rounds } = simulateSession(n, c, 12);
      for (const round of rounds) {
        checkNoduplicateInRound(round);
      }
    });
  }
});

describe('matchmaking — rest fairness (max - min ≤ 1)', () => {
  it('5 players / 1 court over 12 rounds', () => {
    const { history } = simulateSession(5, 1, 12);
    checkRestFairness(history, makePlayers(5));
  });

  it('9 players / 2 courts over 12 rounds', () => {
    const { history } = simulateSession(9, 2, 12);
    checkRestFairness(history, makePlayers(9));
  });

  it('7 players / 1 court over 12 rounds', () => {
    const { history } = simulateSession(7, 1, 12);
    checkRestFairness(history, makePlayers(7));
  });
});

describe('matchmaking — match fairness (max - min ≤ 1)', () => {
  it('5 players / 1 court over 12 rounds', () => {
    const { history } = simulateSession(5, 1, 12);
    checkMatchFairness(history, makePlayers(5));
  });

  it('9 players / 2 courts over 12 rounds', () => {
    const { history } = simulateSession(9, 2, 12);
    checkMatchFairness(history, makePlayers(9));
  });
});

describe('matchmaking — no starvation (every player plays ≥ 1 match)', () => {
  it('12 players / 2 courts over 12 rounds', () => {
    const { history } = simulateSession(12, 2, 12);
    checkNoStarvation(history, makePlayers(12), 12);
  });
});

describe('matchmaking — determinism (same seed ⇒ identical output)', () => {
  it('8 players / 2 courts', () => {
    checkDeterminism(8, 2);
  });

  it('9 players / 2 courts', () => {
    checkDeterminism(9, 2);
  });
});

describe('matchmaking — 5 players / 1 court rest cycle', () => {
  it('after 5 rounds every player has rested exactly once', () => {
    const { history } = simulateSession(5, 1, 5);
    const players = makePlayers(5);
    for (const id of players) {
      expect(history.restCount[id] ?? 0).toBe(1);
    }
  });
});

describe('matchmaking — swapPlayers pure override', () => {
  it('swaps two players without mutating input round', () => {
    const { rounds } = simulateSession(8, 2, 1);
    const round = rounds[0]!;
    const frozen = JSON.stringify(round);

    // Find two playing players in different positions
    const allPlaying = round.matches.flatMap((m) => m.teams.flat());
    const [a, b] = [allPlaying[0]!, allPlaying[allPlaying.length - 1]!];

    const swapped = swapPlayers(round, a, b);

    // Input not mutated
    expect(JSON.stringify(round)).toBe(frozen);

    // a and b are swapped in the output
    const swappedPlaying = swapped.matches.flatMap((m) => m.teams.flat());
    const origIdxA = allPlaying.indexOf(a);
    const origIdxB = allPlaying.indexOf(b);
    expect(swappedPlaying[origIdxA]).toBe(b);
    expect(swappedPlaying[origIdxB]).toBe(a);
  });
});

describe('matchmaking — substitutePlayer', () => {
  it('replaces a player in the round', () => {
    const { rounds } = simulateSession(8, 2, 1);
    const round = rounds[0]!;
    const outId = round.matches[0]!.teams[0]![0]!;
    const inId = 'SUBSTITUTE';

    const subRound = substitutePlayer(round, outId, inId);
    const allPlaying = subRound.matches.flatMap((m) => m.teams.flat());
    expect(allPlaying).toContain(inId);
    expect(allPlaying).not.toContain(outId);
  });
});

describe('matchmaking — performance', () => {
  it('generates a round for 20 players in < 50ms', () => {
    const playerIds = makePlayers(20);
    const participants = makeParticipants(playerIds);
    const courts = makeCourts(5);
    const history = buildHistoryMatrix(participants, []);

    const input: GenerateRoundInput = {
      roundNumber: 1,
      eligiblePlayerIds: playerIds,
      courts,
      shape: { teamsPerMatch: 2, playersPerTeam: 2 },
      history,
      strategy: 'americano',
      seed: 42,
    };

    const start = Date.now();
    generateRound(input);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});
