/** Player statistics repository: batched, idempotent session commit and its compensating revert. */

import {
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

import type { Id } from '@/types/common';
import type { PlayerSessionResultDoc, PlayerSportStatsDoc, PlayerSportSummary } from '@/types/player';
import type { RpEventDoc, SessionCommitPayload } from '@/types/stats';
import type { SportId } from '@/types/sport';
import { SessionAlreadyCommittedError } from '@/core/matchmaking/errors';
import { revertStats } from '@/core/session/finish';
import { SCHEMA_VERSION } from '@/core/session/sessionEngine';
import { createId } from '@/core/utils/id';
import { getDb } from './firebase';
import { decode, encode } from './converters';
import { track } from './observable';
import { paths } from './paths';

const GUARD_READ_TIMEOUT_MS = 2500;

export const statsRepo = {
  async getSportStats(hostId: Id, playerId: Id, sportId: SportId): Promise<PlayerSportStatsDoc | null> {
    const snap = await getDoc(paths.sportStats(hostId, playerId, sportId));
    return snap.exists() ? decode<PlayerSportStatsDoc>(snap.data()) : null;
  },

  async listSessionResults(hostId: Id, playerId: Id, sportId: SportId, limit: number): Promise<PlayerSessionResultDoc[]> {
    const snap = await getDocs(
      query(paths.sessionResults(hostId, playerId), where('sportId', '==', sportId), orderBy('playedAt', 'desc'), fsLimit(limit)),
    );
    return snap.docs.map((d) => decode<PlayerSessionResultDoc>(d.data()));
  },

  async listRpEvents(hostId: Id, playerId: Id, sportId: SportId, limit: number): Promise<RpEventDoc[]> {
    const snap = await getDocs(
      query(paths.rpEvents(hostId, playerId), where('sportId', '==', sportId), orderBy('createdAt', 'desc'), fsLimit(limit)),
    );
    return snap.docs.map((d) => decode<RpEventDoc>(d.data()));
  },

  /**
   * One atomic batch: 4 writes per participant (<= 64 x 4 + 1 = 257 ops, under the 500 limit).
   * The session's `rankingApplied` flag flips inside the same batch, which is what makes a second
   * commit detectable. Fire-and-forget like every write; atomicity survives going offline.
   */
  async commitSessionResults(hostId: Id, sessionId: Id, payload: SessionCommitPayload): Promise<void> {
    // Idempotency guard against a second device/tab. Must never block the write: bounded wait, then rely on the local flag.
    const session = await Promise.race([
      getDoc(paths.session(sessionId)).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), GUARD_READ_TIMEOUT_MS)),
    ]);
    if (session?.exists() && session.data()['rankingApplied'] === true) throw new SessionAlreadyCommittedError(sessionId);

    const now = Date.now();
    const batch = writeBatch(getDb());
    for (const p of payload.perPlayer) {
      batch.set(paths.sessionResult(hostId, p.playerId, sessionId), encode(p.result));
      batch.set(paths.sportStats(hostId, p.playerId, payload.sportId), encode(p.statsPatch));
      const event: RpEventDoc = { id: createId(), schemaVersion: SCHEMA_VERSION, ...p.rpEvent };
      batch.set(paths.rpEvent(hostId, p.playerId, event.id), encode(event));
      batch.set(
        paths.player(hostId, p.playerId),
        encode({ summary: { [payload.sportId]: p.summaryPatch }, updatedAt: now }),
        { merge: true },
      );
    }
    batch.update(paths.session(sessionId), encode({ rankingApplied: true, status: 'finished', finishedAt: now, updatedAt: now }));
    track('stats.commit', batch.commit());
  },

  /**
   * Undo a commit after the host edits a finished session: counters are rolled back, the RP ledger
   * stays append-only (a `session_reverted` event is appended), and `rankingApplied` is cleared so
   * the corrected session can be committed again. Reads come from the local cache when offline.
   */
  async revertSessionResults(hostId: Id, sessionId: Id, playerIds: Id[], sportId: SportId): Promise<void> {
    const now = Date.now();
    const batch = writeBatch(getDb());
    for (const playerId of playerIds) {
      const [resultSnap, statsSnap, eventsSnap] = await Promise.all([
        getDoc(paths.sessionResult(hostId, playerId, sessionId)),
        getDoc(paths.sportStats(hostId, playerId, sportId)),
        getDocs(query(paths.rpEvents(hostId, playerId), where('sessionId', '==', sessionId), where('reason', '==', 'session_result'))),
      ]);
      const eventDoc = eventsSnap.docs[0];
      if (!resultSnap.exists() || !statsSnap.exists() || !eventDoc) continue;

      const result = decode<PlayerSessionResultDoc>(resultSnap.data());
      const stats = decode<PlayerSportStatsDoc>(statsSnap.data());
      const original = decode<RpEventDoc>(eventDoc.data());
      const reverted = revertStats(stats, result, original.rpBefore, now);

      const compensating: RpEventDoc = {
        id: createId(),
        schemaVersion: SCHEMA_VERSION,
        playerId,
        sportId,
        sessionId,
        reason: 'session_reverted',
        breakdown: original.breakdown,
        delta: reverted.rp - stats.rp,
        rpBefore: stats.rp,
        rpAfter: reverted.rp,
        tierBefore: stats.tier,
        tierAfter: reverted.tier,
        createdAt: now,
      };
      const summary: PlayerSportSummary = {
        tier: reverted.tier,
        division: reverted.division,
        stars: reverted.stars,
        rp: reverted.rp,
        matchesPlayed: reverted.matchesPlayed,
        wins: reverted.wins,
        sessionsPlayed: reverted.sessionsPlayed,
        lastPlayedAt: reverted.lastPlayedAt,
      };
      batch.set(paths.sportStats(hostId, playerId, sportId), encode(reverted));
      batch.delete(paths.sessionResult(hostId, playerId, sessionId));
      batch.set(paths.rpEvent(hostId, playerId, compensating.id), encode(compensating));
      batch.set(paths.player(hostId, playerId), encode({ summary: { [sportId]: summary }, updatedAt: now }), { merge: true });
    }
    batch.update(paths.session(sessionId), encode({ rankingApplied: false, status: 'live', finishedAt: null, updatedAt: now }));
    track('stats.revert', batch.commit());
  },
};
