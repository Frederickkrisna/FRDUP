/**
 * Domain error types. Mirrors docs/api_contract.md §8.
 * All domain functions throw these typed errors; never swallow with empty catch.
 */

export class UnknownSportError extends Error {
  constructor(id: string) {
    super(`Unknown sport: "${id}"`);
    this.name = 'UnknownSportError';
  }
}

export class StaleRoundError extends Error {
  constructor(
    readonly expected: number,
    readonly actual: number,
  ) {
    super(`Stale round: expected revision ${expected}, got ${actual}`);
    this.name = 'StaleRoundError';
  }
}

export class InsufficientPlayersError extends Error {
  constructor(
    readonly needed: number,
    readonly have: number,
  ) {
    super(`Need ${needed} players to fill a match, only have ${have}`);
    this.name = 'InsufficientPlayersError';
  }
}

export class JoinCodeInvalidError extends Error {
  constructor() {
    super('Join code is invalid');
    this.name = 'JoinCodeInvalidError';
  }
}

export class JoinCodeExpiredError extends Error {
  constructor() {
    super('Join code has expired');
    this.name = 'JoinCodeExpiredError';
  }
}

export class SessionAlreadyCommittedError extends Error {
  constructor(sessionId: string) {
    super(`Session ${sessionId} has already been committed`);
    this.name = 'SessionAlreadyCommittedError';
  }
}

export class CourtNotClaimedError extends Error {
  constructor(courtId: string) {
    super(`Court ${courtId} is not claimed by this co-host`);
    this.name = 'CourtNotClaimedError';
  }
}
