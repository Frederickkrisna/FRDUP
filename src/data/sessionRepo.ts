/** Session, co-host, round and bill repositories. */

import {
  deleteDoc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore';

import type { Id, Millis } from '@/types/common';
import type { BillDoc } from '@/types/bill';
import type { Match, RoundDoc } from '@/types/round';
import type { NewSessionInput, SessionDoc } from '@/types/session';
import type { SportId } from '@/types/sport';
import type { CoHostDoc, SessionCodeDoc } from '@/types/stats';
import { JoinCodeExpiredError, JoinCodeInvalidError, StaleRoundError } from '@/core/matchmaking/errors';
import {
  JOIN_CODE_TTL_MS,
  generateJoinCode,
  isJoinCodeLive,
  isValidJoinCode,
  normalizeJoinCode,
} from '@/core/session/joinCode';
import { SCHEMA_VERSION } from '@/core/session/sessionEngine';
import { createId } from '@/core/utils/id';
import { getDb } from './firebase';
import { decode, encode } from './converters';
import { observable, track, type Observable } from './observable';
import { paths } from './paths';

/* --------------------------------------------------------------------------- sessions */

export function newSessionDoc(input: NewSessionInput, now: Millis): SessionDoc {
  return {
    id: createId(),
    schemaVersion: SCHEMA_VERSION,
    hostId: input.hostId,
    hostAnonUid: input.hostAnonUid,
    sportId: input.sportId,
    format: input.format,
    status: 'live',
    title: input.title ?? null,
    venue: input.venue ?? null,
    playedAt: now,
    sportConfig: input.sportConfig,
    scoreInput: input.scoreInput,
    courts: input.courts.map((c, index) => ({ id: createId(), index, label: c.label, isActive: true })),
    targetRounds: input.targetRounds ?? null,
    plannedEndAt: input.plannedEndAt ?? null,
    participants: input.participants,
    currentRoundNumber: 1,
    completedRoundCount: 0,
    joinCode: null,
    joinCodeExpiresAt: null,
    coHostCount: 0,
    rankingApplied: false,
    billId: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
  };
}

const JOIN_CODE_WRITE_TIMEOUT_MS = 10_000;

export class WriteTimeoutError extends Error {
  constructor() {
    super('write timed out');
    this.name = 'WriteTimeoutError';
  }
}

/** Rejects if the server has not acknowledged in time (the write itself stays queued). */
function withTimeout<T>(write: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new WriteTimeoutError()), ms);
    write.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

function randomUint32(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] ?? 0;
}

export const sessionRepo = {
  /** Writes a locally-minted session doc. Resolves immediately (offline-safe). */
  create(input: NewSessionInput): SessionDoc {
    const session = newSessionDoc(input, Date.now());
    track('session.create', setDoc(paths.session(session.id), encode(session)));
    return session;
  },

  /** Full replace: the live store is the source of truth, Firestore is the replica. */
  put(session: SessionDoc): void {
    track('session.put', setDoc(paths.session(session.id), encode(session)));
  },

  async get(sessionId: Id): Promise<SessionDoc | null> {
    const snap = await getDoc(paths.session(sessionId));
    return snap.exists() ? decode<SessionDoc>(snap.data()) : null;
  },

  observe(sessionId: Id): Observable<SessionDoc | null> {
    return observable((next, error) =>
      onSnapshot(
        paths.session(sessionId),
        (snap) => next(snap.exists() ? decode<SessionDoc>(snap.data()) : null),
        error,
      ),
    );
  },

  async listByHost(
    hostId: Id,
    opts?: { limit?: number; sportId?: SportId; cursor?: Millis },
  ): Promise<SessionDoc[]> {
    const constraints: QueryConstraint[] = [where('hostId', '==', hostId)];
    if (opts?.sportId) constraints.push(where('sportId', '==', opts.sportId));
    constraints.push(orderBy('playedAt', 'desc'));
    if (opts?.cursor !== undefined) constraints.push(startAfter(Timestamp.fromMillis(opts.cursor)));
    constraints.push(fsLimit(opts?.limit ?? 20));
    const snap = await getDocs(query(paths.sessions(), ...constraints));
    return snap.docs.map((d) => decode<SessionDoc>(d.data()));
  },

  /** The most recently touched live/paused session, if any (resume banner). */
  async findActive(hostId: Id): Promise<SessionDoc | null> {
    for (const status of ['live', 'paused'] as const) {
      const snap = await getDocs(
        query(paths.sessions(), where('hostId', '==', hostId), where('status', '==', status), orderBy('updatedAt', 'desc'), fsLimit(1)),
      );
      const first = snap.docs[0];
      if (first) return decode<SessionDoc>(first.data());
    }
    return null;
  },

  update(sessionId: Id, patch: Partial<SessionDoc>): void {
    track('session.update', updateDoc(paths.session(sessionId), encode({ ...patch, updatedAt: Date.now() })));
  },

  finish(sessionId: Id): void {
    const now = Date.now();
    track('session.finish', updateDoc(paths.session(sessionId), encode({ status: 'finished', finishedAt: now, updatedAt: now })));
  },

  /* ---------------------------------------------------------------- join codes */

  /**
   * Issues a fresh code. Probes for collisions (a missing doc reads as "not exists" under the rules),
   * then writes the lookup doc and mirrors the code onto the session. Needs a network round-trip
   * only for the collision probe; offline it falls back to a single optimistic attempt.
   */
  async issueJoinCode(sessionId: Id, hostUid: string, ttlMs: number = JOIN_CODE_TTL_MS): Promise<{ code: string; expiresAt: Millis }> {
    const now = Date.now();
    const expiresAt = now + ttlMs;
    let code = generateJoinCode(randomUint32);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const existing = await getDoc(paths.code(code));
        if (!existing.exists()) break;
        const data = decode<SessionCodeDoc>(existing.data());
        // Reusable only if it is ours: a dead code owned by another host cannot be overwritten (rules).
        if (data.hostAnonUid === hostUid && (data.sessionId === sessionId || data.expiresAt <= now)) break;
        code = generateJoinCode(randomUint32);
      } catch {
        break; // offline / permission: accept the optimistic code
      }
    }
    const doc: SessionCodeDoc = { id: code, sessionId, hostAnonUid: hostUid, expiresAt, createdAt: now };
    // Awaited (bounded): a code the server never accepted would put a QR on screen that cannot work.
    await withTimeout(
      Promise.all([
        setDoc(paths.code(code), encode(doc)),
        updateDoc(paths.session(sessionId), encode({ joinCode: code, joinCodeExpiresAt: expiresAt, updatedAt: now })),
      ]),
      JOIN_CODE_WRITE_TIMEOUT_MS,
    );
    return { code, expiresAt };
  },

  revokeJoinCode(sessionId: Id, code: string | null): void {
    const now = Date.now();
    if (code) track('session.codeRevoke', setDoc(paths.code(code), encode({ expiresAt: now - 1 }), { merge: true }));
    track('session.codeClear', updateDoc(paths.session(sessionId), encode({ joinCode: null, joinCodeExpiresAt: null, updatedAt: now })));
  },

  /** Resolves a code to a session. Requires network (a stranger has nothing cached). */
  async resolveJoinCode(raw: string): Promise<SessionDoc> {
    const code = normalizeJoinCode(raw);
    if (!isValidJoinCode(code)) throw new JoinCodeInvalidError();
    const codeSnap = await getDoc(paths.code(code));
    if (!codeSnap.exists()) throw new JoinCodeInvalidError();
    const entry = decode<SessionCodeDoc>(codeSnap.data());
    if (!isJoinCodeLive(entry.expiresAt, Date.now())) throw new JoinCodeExpiredError();
    const sessionSnap = await getDoc(paths.session(entry.sessionId));
    if (!sessionSnap.exists()) throw new JoinCodeInvalidError();
    return decode<SessionDoc>(sessionSnap.data());
  },

  /* ------------------------------------------------------------------ co-hosts */

  async attachCoHost(sessionId: Id, coHost: CoHostDoc): Promise<void> {
    // Awaited on purpose: joining must confirm the rules accepted the code before navigating.
    await setDoc(paths.cohost(sessionId, coHost.id), encode(coHost));
  },

  observeCoHosts(sessionId: Id): Observable<CoHostDoc[]> {
    return observable((next, error) =>
      onSnapshot(paths.cohosts(sessionId), (snap) => next(snap.docs.map((d) => decode<CoHostDoc>(d.data()))), error),
    );
  },

  claimCourts(sessionId: Id, anonUid: string, courtIds: Id[]): void {
    track('cohost.claim', updateDoc(paths.cohost(sessionId, anonUid), { claimedCourtIds: courtIds, lastSeenAt: Timestamp.now() }));
  },

  heartbeat(sessionId: Id, anonUid: string): void {
    track('cohost.heartbeat', updateDoc(paths.cohost(sessionId, anonUid), { lastSeenAt: Timestamp.now() }));
  },

  leave(sessionId: Id, anonUid: string): void {
    track('cohost.leave', setDoc(paths.cohost(sessionId, anonUid), { claimedCourtIds: [] }, { merge: true }));
  },
};

/* ----------------------------------------------------------------------------- rounds */

export const roundRepo = {
  async listBySession(sessionId: Id): Promise<RoundDoc[]> {
    const snap = await getDocs(query(paths.rounds(sessionId), orderBy('roundNumber', 'asc')));
    return snap.docs.map((d) => decode<RoundDoc>(d.data()));
  },

  /**
   * Emits only rounds with no local pending write: our own optimistic echoes are skipped, so the
   * store only ever reconciles against what the server (or another device) actually holds.
   */
  observeBySession(sessionId: Id): Observable<RoundDoc[]> {
    return observable((next, error) =>
      onSnapshot(
        query(paths.rounds(sessionId), orderBy('roundNumber', 'asc')),
        (snap) => next(snap.docs.filter((d) => !d.metadata.hasPendingWrites).map((d) => decode<RoundDoc>(d.data()))),
        error,
      ),
    );
  },

  /**
   * Whole-round compare-and-set (transaction => needs network). Used when a co-host is registered
   * and we are online. Returns stale with the server copy when someone else wrote first; the caller
   * merges (core/session/merge) and retries once.
   */
  async commitRound(
    sessionId: Id,
    round: RoundDoc,
    baseRevision: number,
  ): Promise<{ status: 'ok' } | { status: 'stale'; remote: RoundDoc }> {
    const ref = paths.round(sessionId, round.id);
    return runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) {
        const remote = decode<RoundDoc>(snap.data());
        if (remote.revision !== baseRevision) return { status: 'stale' as const, remote };
      }
      tx.set(ref, encode(round));
      return { status: 'ok' as const };
    });
  },

  /** Last-write-wins full write. Used offline, or when no co-host is registered. */
  upsert(sessionId: Id, round: RoundDoc): void {
    track('round.upsert', setDoc(paths.round(sessionId, round.id), encode(round)));
  },

  /**
   * Compare-and-set on `revision` (transaction => needs network). Rejects with StaleRoundError when
   * someone else wrote first; the caller merges via core/session/merge and retries.
   */
  async updateMatch(
    sessionId: Id,
    roundId: Id,
    matchId: Id,
    patch: Partial<Match>,
    expectedRevision: number,
    uid: string,
  ): Promise<RoundDoc> {
    const ref = paths.round(sessionId, roundId);
    return runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new StaleRoundError(expectedRevision, -1);
      const current = decode<RoundDoc>(snap.data());
      if (current.revision !== expectedRevision) throw new StaleRoundError(expectedRevision, current.revision);
      const now = Date.now();
      const next: RoundDoc = {
        ...current,
        matches: current.matches.map((m) => (m.id === matchId ? { ...m, ...patch, updatedAt: now } : m)),
        revision: current.revision + 1,
        lastWriterUid: uid,
        updatedAt: now,
      };
      tx.set(ref, encode(next));
      return next;
    });
  },

  delete(sessionId: Id, roundId: Id): void {
    track('round.delete', deleteDoc(paths.round(sessionId, roundId)));
  },
};

/* ------------------------------------------------------------------------------ bill */

export const billRepo = {
  async get(sessionId: Id): Promise<BillDoc | null> {
    const snap = await getDoc(paths.bill(sessionId));
    return snap.exists() ? decode<BillDoc>(snap.data()) : null;
  },

  observe(sessionId: Id): Observable<BillDoc | null> {
    return observable((next, error) =>
      onSnapshot(paths.bill(sessionId), (snap) => next(snap.exists() ? decode<BillDoc>(snap.data()) : null), error),
    );
  },

  save(sessionId: Id, bill: BillDoc): void {
    track('bill.save', setDoc(paths.bill(sessionId), encode(bill)));
  },
};
