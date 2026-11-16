/**
 * Pure session-runtime operations on RoundDoc / SessionDoc.
 * The store and the repositories call these; screens never compute outcomes themselves.
 * See docs/implementation_be.md §6.2 and docs/api_contract.md §7.
 */

import type { Id, Millis } from '@/types/common';
import type { Match, RoundDoc, ScoreState } from '@/types/round';
import type { CourtDef, SessionDoc, SessionParticipant } from '@/types/session';
import type { MatchShape, ScoreInputSpec, SportPlugin } from '@/types/sport';
import { buildHistoryMatrix } from '@/core/matchmaking/historyMatrix';
import { generateRound, substitutePlayer, swapPlayers } from '@/core/matchmaking/generateRound';
import { computeStandings } from '@/core/standings/computeStandings';
import { createId } from '@/core/utils/id';

export const SCHEMA_VERSION = 1;

/** Hard caps (docs/implementation_be.md §3.5). */
export const LIMITS = { participants: 64, courts: 12, rounds: 200 } as const;

/** Formats the runtime actually implements. `team_fixed` / `free` are deferred (see progress.md). */
export const IMPLEMENTED_FORMATS = ['americano', 'mexicano'] as const;

/* ------------------------------------------------------------------ match shape */

/**
 * The shape a session actually plays with. Plugins declare a default; the singleMode (badminton)
 * and doublesMode (table tennis, billiard) settings switch between 1v1 and 2v2. Scoring is
 * unaffected, only who is on court.
 */
export function resolveMatchShape(plugin: SportPlugin, config: Record<string, number | boolean | string>): MatchShape {
  const base = plugin.matchShape;
  if (base.teamsPerMatch !== 2) return base;
  if (config['singleMode'] === true) return { teamsPerMatch: 2, playersPerTeam: 1 };
  if (config['doublesMode'] === true) return { teamsPerMatch: 2, playersPerTeam: 2 };
  return base;
}

export function playersPerMatch(shape: MatchShape): number {
  return shape.teamsPerMatch * shape.playersPerTeam;
}

/** How many play / sit out each round for a given roster and court count. */
export function rotationPreview(playerCount: number, courts: number, shape: MatchShape): { playing: number; resting: number; activeCourts: number } {
  const per = playersPerMatch(shape);
  const activeCourts = Math.max(0, Math.min(courts, Math.floor(playerCount / per)));
  const playing = activeCourts * per;
  return { playing, resting: playerCount - playing, activeCourts };
}

/* ------------------------------------------------------------------ eligibility */

export function isEligibleForRound(p: SessionParticipant, roundNumber: number): boolean {
  return p.joinedAtRound <= roundNumber && (p.leftAtRound === null || roundNumber < p.leftAtRound);
}

export function eligiblePlayerIds(participants: SessionParticipant[], roundNumber: number): Id[] {
  return participants.filter((p) => isEligibleForRound(p, roundNumber)).map((p) => p.playerId);
}

/* ------------------------------------------------------------------ round building */

export interface BuildNextRoundArgs {
  session: SessionDoc;
  rounds: RoundDoc[];
  plugin: SportPlugin;
  seed: number;
  uid: string;
  now: Millis;
}

/** Generates the next round (Americano/Mexicano) from history. Throws InsufficientPlayersError. */
export function buildNextRound({ session, rounds, plugin, seed, uid, now }: BuildNextRoundArgs): RoundDoc {
  const roundNumber = rounds.length === 0 ? 1 : Math.max(...rounds.map((r) => r.roundNumber)) + 1;
  const played = rounds.filter((r) => r.status !== 'scheduled');
  const history = buildHistoryMatrix(session.participants, played);
  const strategy = session.format;
  const standings =
    strategy === 'mexicano' && played.length > 0
      ? computeStandings(session.participants, played, plugin, session.scoreInput)
      : undefined;

  const out = generateRound({
    roundNumber,
    eligiblePlayerIds: eligiblePlayerIds(session.participants, roundNumber),
    courts: session.courts,
    shape: resolveMatchShape(plugin, session.sportConfig),
    history,
    standings,
    strategy,
    seed,
  });

  const matches: Match[] = out.matches.map((m) => ({
    ...m,
    status: 'scheduled',
    score: plugin.createInitialScore(session.scoreInput),
    startedAt: null,
    completedAt: null,
  }));

  return {
    id: createId(),
    schemaVersion: SCHEMA_VERSION,
    sessionId: session.id,
    roundNumber,
    status: 'in_progress',
    matches,
    restingPlayerIds: out.restingPlayerIds,
    generatedBy: strategy === 'mexicano' && standings ? 'mexicano' : 'auto',
    seed,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    lastWriterUid: uid,
    revision: 1,
  };
}

/* ------------------------------------------------------------------ mutation helpers */

/** Bumps revision + writer metadata. Every mutation below ends with this. */
export function touchRound(round: RoundDoc, uid: string, now: Millis): RoundDoc {
  return { ...round, updatedAt: now, lastWriterUid: uid, revision: round.revision + 1 };
}

export function isMatchSettled(m: Match): boolean {
  return m.status === 'completed' || m.status === 'voided';
}

export function allMatchesSettled(round: RoundDoc): boolean {
  return round.matches.length > 0 && round.matches.every(isMatchSettled);
}

export function deriveRoundStatus(round: RoundDoc, now: Millis): Pick<RoundDoc, 'status' | 'completedAt'> {
  if (allMatchesSettled(round)) return { status: 'completed', completedAt: round.completedAt ?? now };
  return { status: round.status === 'completed' ? 'in_progress' : round.status, completedAt: null };
}

function mapMatch(round: RoundDoc, matchId: Id, fn: (m: Match) => Match, uid: string, now: Millis): RoundDoc {
  let changed = false;
  const matches = round.matches.map((m) => {
    if (m.id !== matchId) return m;
    changed = true;
    const edited = fn(m);
    return edited === m ? m : { ...edited, updatedAt: now };
  });
  if (!changed) return round;
  const next = { ...round, matches };
  return touchRound({ ...next, ...deriveRoundStatus(next, now) }, uid, now);
}

export interface ScoreChange {
  teamIndex: number;
  value: number;
  mode: 'set' | 'delta';
}

/** Applies a score change through the plugin. The first edit marks the match in_progress. */
export function setMatchScore(
  round: RoundDoc,
  matchId: Id,
  change: ScoreChange,
  plugin: SportPlugin,
  spec: ScoreInputSpec,
  uid: string,
  now: Millis,
): RoundDoc {
  return mapMatch(
    round,
    matchId,
    (m) => {
      if (m.status === 'voided') return m;
      const score: ScoreState = plugin.applyScore(m.score, spec, change);
      const status = m.status === 'scheduled' ? 'in_progress' : m.status;
      return { ...m, score, status, startedAt: m.startedAt ?? now };
    },
    uid,
    now,
  );
}

/** Why a match cannot be completed yet; `null` means it can. Keys are i18n keys. */
export function completionBlocker(m: Match, plugin: SportPlugin, spec: ScoreInputSpec): string | null {
  if (m.status === 'voided') return 'session.court.blocker.voided';
  if (m.status === 'scheduled') return 'session.court.blocker.noScore';
  const check = plugin.validate(m.score, spec);
  if (!check.ok) return check.errors[0]?.key ?? 'session.court.blocker.invalid';
  if (spec.type === 'race_to_n' && !m.score.isComplete) return 'session.court.blocker.notDecided';
  return null;
}

export function completeMatch(
  round: RoundDoc,
  matchId: Id,
  plugin: SportPlugin,
  spec: ScoreInputSpec,
  uid: string,
  now: Millis,
): RoundDoc {
  return mapMatch(
    round,
    matchId,
    (m) => {
      if (completionBlocker(m, plugin, spec) !== null) return m;
      const score = plugin.evaluate({ ...m.score, isComplete: true }, spec);
      return { ...m, status: 'completed', score: { ...score, isComplete: true }, completedAt: now };
    },
    uid,
    now,
  );
}

export function reopenMatch(round: RoundDoc, matchId: Id, uid: string, now: Millis): RoundDoc {
  return mapMatch(
    round,
    matchId,
    (m) => (m.status === 'completed' ? { ...m, status: 'in_progress', completedAt: null } : m),
    uid,
    now,
  );
}

export function voidMatch(round: RoundDoc, matchId: Id, uid: string, now: Millis): RoundDoc {
  return mapMatch(round, matchId, (m) => ({ ...m, status: 'voided', completedAt: now }), uid, now);
}

export function resetMatchScore(
  round: RoundDoc,
  matchId: Id,
  plugin: SportPlugin,
  spec: ScoreInputSpec,
  uid: string,
  now: Millis,
): RoundDoc {
  return mapMatch(
    round,
    matchId,
    (m) => ({ ...m, status: 'scheduled', score: plugin.createInitialScore(spec), startedAt: null, completedAt: null }),
    uid,
    now,
  );
}

/** Voids every unsettled match in a round (the escape hatch on the finish screen). */
export function voidUnsettled(round: RoundDoc, uid: string, now: Millis): RoundDoc {
  const matches = round.matches.map((m) => (isMatchSettled(m) ? m : { ...m, status: 'voided' as const, completedAt: now }));
  const next = { ...round, matches };
  return touchRound({ ...next, ...deriveRoundStatus(next, now) }, uid, now);
}

/* ------------------------------------------------------------------ manual overrides */

export function swapInRound(round: RoundDoc, a: Id, b: Id, uid: string, now: Millis): RoundDoc {
  return touchRound(swapPlayers(round, a, b), uid, now);
}

export function substituteInRound(round: RoundDoc, outId: Id, inId: Id, uid: string, now: Millis): RoundDoc {
  return touchRound(substitutePlayer(round, outId, inId), uid, now);
}

/* ------------------------------------------------------------------ participants / courts */

export function addParticipant(
  session: SessionDoc,
  participant: SessionParticipant,
  fromRound: number,
  now: Millis,
): SessionDoc {
  if (session.participants.some((p) => p.playerId === participant.playerId && p.leftAtRound === null)) return session;
  if (session.participants.length >= LIMITS.participants) return session;
  const others = session.participants.filter((p) => p.playerId !== participant.playerId);
  return {
    ...session,
    participants: [...others, { ...participant, joinedAtRound: fromRound, leftAtRound: null }],
    updatedAt: now,
  };
}

export function removeParticipant(session: SessionDoc, playerId: Id, fromRound: number, now: Millis): SessionDoc {
  return {
    ...session,
    participants: session.participants.map((p) => (p.playerId === playerId ? { ...p, leftAtRound: fromRound } : p)),
    updatedAt: now,
  };
}

export function setCourtActive(session: SessionDoc, courtId: Id, active: boolean, now: Millis): SessionDoc {
  const courts: CourtDef[] = session.courts.map((c) => (c.id === courtId ? { ...c, isActive: active } : c));
  return { ...session, courts, updatedAt: now };
}

/** At least one court must stay on, or no round can ever be generated. */
export function canDeactivateCourt(session: SessionDoc, courtId: Id): boolean {
  const target = session.courts.find((c) => c.id === courtId);
  if (!target?.isActive) return true;
  return session.courts.filter((c) => c.isActive).length > 1;
}

/**
 * Courts the live screen shows for a round: every court that holds a match in this round (even
 * if it was switched off mid-round, so its match can still be finished or voided), in court order.
 * Returns the session's own court objects, so memoised court cards keep their props identity.
 */
export function courtsForRound(session: SessionDoc, round: RoundDoc): CourtDef[] {
  const used = new Set(round.matches.map((m) => m.courtId));
  return session.courts.filter((c) => used.has(c.id));
}

/** Players currently playing in a round, used to validate swaps/substitutions. */
export function playersInRound(round: RoundDoc): Id[] {
  return [...round.matches.flatMap((m) => m.teams.flat()), ...round.restingPlayerIds];
}
