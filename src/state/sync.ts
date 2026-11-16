/**
 * Background replication for the live session (docs/implementation_be.md §5):
 *   store (truth) --debounced 400 ms--> Firestore, and Firestore --> store reconciliation.
 * Nothing here is ever awaited by a tap.
 */

import type { Id } from '@/types/common';
import type { RoundDoc } from '@/types/round';
import { logger } from '@/core/utils/logger';
import { mergeRounds } from '@/core/session/merge';
import { billRepo, roundRepo, sessionRepo } from '@/data/sessionRepo';
import { useBootStore } from './bootStore';
import { useSessionStore } from './sessionStore';
import { useSyncStore } from './syncStore';

const DEBOUNCE_MS = 400;

let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function scheduleFlush(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushNow(), DEBOUNCE_MS);
}

/** Whether writes must go through the compare-and-set path. */
function needsCas(): boolean {
  const { role } = useSessionStore.getState();
  const { online, coHosts } = useSyncStore.getState();
  if (!online) return false; // transactions need the network; offline => last-write-wins
  return role === 'cohost' || coHosts.length > 0;
}

/** Resolves once the server holds this round (directly, or through the offline queue later). */
async function writeRound(sessionId: Id, round: RoundDoc): Promise<void> {
  if (!needsCas()) {
    useSessionStore.getState().markRoundBase(round.id, round.revision);
    return roundRepo.upsert(sessionId, round);
  }
  const store = useSessionStore.getState();
  const base = store.baseRevision[round.id] ?? 0;
  try {
    const first = await roundRepo.commitRound(sessionId, round, base);
    if (first.status === 'ok') {
      store.markRoundBase(round.id, round.revision);
      return;
    }
    // Stale: merge field-by-field, adopt the merge locally, retry once against the server revision.
    const uid = useBootStore.getState().uid ?? 'local';
    const merged = mergeRounds(round, first.remote, store.role, uid, Date.now());
    useSessionStore.getState().applyRemoteRounds([first.remote]);
    const second = await roundRepo.commitRound(sessionId, merged, first.remote.revision);
    if (second.status === 'ok') useSessionStore.getState().markRoundBase(round.id, merged.revision);
    else await roundRepo.upsert(sessionId, merged); // lost the race twice: last write wins, never drop a score
  } catch (error) {
    // Network dropped mid-transaction: fall back to the durable offline queue.
    logger.warn('CAS write failed; queueing last-write-wins', (error as { code?: string }).code);
    await roundRepo.upsert(sessionId, round);
  }
}

/**
 * The exact object last handed to Firestore per document, until the server acknowledges it.
 * Dirty flags are cleared only on that acknowledgement: a reload or a closed tab before the ack
 * leaves the flag set (it is persisted), so the next start sends the write again. Clearing at send
 * time lost the last score whenever the page went away before Firestore's own queue was saved.
 */
const inflight = new Map<string, unknown>();

function send(key: string, value: unknown, write: () => Promise<void>, onAck: () => void): void {
  if (inflight.get(key) === value) return; // already on its way (Firestore redelivers after reconnects)
  inflight.set(key, value);
  write().then(
    () => {
      if (inflight.get(key) === value) inflight.delete(key);
      onAck();
    },
    (error: unknown) => {
      // Stays dirty: the next edit, reconnect or app start retries it.
      if (inflight.get(key) === value) inflight.delete(key);
      logger.warn(`replica write failed: ${key}`, (error as { code?: string } | null)?.code);
    },
  );
}

const NO_FLUSH = { roundIds: [] as Id[], session: false, bill: false };

export async function flushNow(): Promise<void> {
  if (flushing) return scheduleFlush();
  flushing = true;
  try {
    const s = useSessionStore.getState();
    const { session } = s;
    if (!session) return;
    const sessionId = session.id;
    const store = () => useSessionStore.getState();

    if (s.sessionDirty) {
      // A co-host never writes the session document: nothing to wait for.
      if (s.role !== 'host') store().markFlushed({ ...NO_FLUSH, session: true });
      else send('session', session, () => sessionRepo.put(session), () => store().session === session && store().markFlushed({ ...NO_FLUSH, session: true }));
    }
    const bill = s.bill;
    if (s.billDirty && s.role === 'host' && bill) {
      send('bill', bill, () => billRepo.save(sessionId, bill), () => store().bill === bill && store().markFlushed({ ...NO_FLUSH, bill: true }));
    }
    for (const id of s.dirtyRounds) {
      const round = s.rounds.find((r) => r.id === id);
      if (!round) {
        store().markFlushed({ ...NO_FLUSH, roundIds: [id] }); // dropped locally (e.g. unplayed round at finish)
        continue;
      }
      // An edit after this send replaces the object, so the ack of an older version clears nothing.
      send(`round:${id}`, round, () => writeRound(sessionId, round), () => store().rounds.find((r) => r.id === id) === round && store().markFlushed({ ...NO_FLUSH, roundIds: [id] }));
    }
  } catch (error) {
    logger.error('flush failed', error);
  } finally {
    flushing = false;
  }
}

/** Mount once for the lifetime of the app (session/_layout). Returns a disposer. */
export function startSessionSync(): () => void {
  const unsubStore = useSessionStore.subscribe((state, prev) => {
    const changed =
      state.dirtyRounds.length > 0 &&
      (state.dirtyRounds !== prev.dirtyRounds || state.rounds !== prev.rounds);
    // Dirty flags stay up until the server acks, so a newer version while one is in flight must also flush.
    const sessionChanged = state.sessionDirty && (!prev.sessionDirty || state.session !== prev.session);
    const billChanged = state.billDirty && (!prev.billDirty || state.bill !== prev.bill);
    if (changed || sessionChanged || billChanged) scheduleFlush();
  });

  const flushImmediately = () => {
    if (document.visibilityState === 'hidden') void flushNow();
  };
  document.addEventListener('visibilitychange', flushImmediately);
  window.addEventListener('pagehide', flushImmediately);
  const onOnline = () => scheduleFlush();
  window.addEventListener('online', onOnline);

  // A reload with unflushed edits must still replicate.
  const s = useSessionStore.getState();
  if (s.dirtyRounds.length > 0 || s.sessionDirty || s.billDirty) scheduleFlush();

  return () => {
    unsubStore();
    document.removeEventListener('visibilitychange', flushImmediately);
    window.removeEventListener('pagehide', flushImmediately);
    window.removeEventListener('online', onOnline);
    if (timer) {
      clearTimeout(timer);
      void flushNow(); // never drop a pending flush on teardown
    }
  };
}

/**
 * Attach Firestore listeners for the active session: rounds (reconcile), session (co-host),
 * co-hosts (host presence). Returns a disposer. Safe to call again on sessionId change.
 */
export function attachSessionListeners(sessionId: Id): () => void {
  const store = useSessionStore.getState();
  const disposers: Array<() => void> = [];

  disposers.push(roundRepo.observeBySession(sessionId).subscribe((remote) => useSessionStore.getState().applyRemoteRounds(remote)));
  disposers.push(
    sessionRepo.observeCoHosts(sessionId).subscribe((coHosts) => {
      useSyncStore.getState().setCoHosts(coHosts);
      if (useSessionStore.getState().role === 'host') useSessionStore.getState().setCoHostCount(coHosts.length);
    }),
  );
  if (store.role === 'cohost') {
    disposers.push(sessionRepo.observe(sessionId).subscribe((remote) => remote && useSessionStore.getState().applyRemoteSession(remote)));
  }
  return () => disposers.forEach((d) => d());
}
