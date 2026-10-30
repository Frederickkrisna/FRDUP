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

async function writeRound(sessionId: Id, round: RoundDoc): Promise<void> {
  if (!needsCas()) {
    roundRepo.upsert(sessionId, round);
    useSessionStore.getState().markRoundBase(round.id, round.revision);
    return;
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
    else roundRepo.upsert(sessionId, merged); // lost the race twice: last write wins, never drop a score
  } catch (error) {
    // Network dropped mid-transaction: fall back to the durable offline queue.
    logger.warn('CAS write failed; queueing last-write-wins', (error as { code?: string }).code);
    roundRepo.upsert(sessionId, round);
  }
}

export async function flushNow(): Promise<void> {
  if (flushing) return scheduleFlush();
  flushing = true;
  try {
    const s = useSessionStore.getState();
    const { session } = s;
    if (!session) return;

    const roundIds = [...s.dirtyRounds];
    const sessionDirty = s.sessionDirty;
    const billDirty = s.billDirty;

    if (sessionDirty && s.role === 'host') sessionRepo.put(session);
    if (billDirty && s.role === 'host' && s.bill) billRepo.save(session.id, s.bill);
    const written = new Map<string, RoundDoc>();
    for (const id of roundIds) {
      const round = useSessionStore.getState().rounds.find((r) => r.id === id);
      if (round) {
        await writeRound(session.id, round);
        written.set(id, round);
      }
    }
    // An edit that landed during the awaits above must stay dirty (its own scheduled flush picks it up).
    const now = useSessionStore.getState();
    const settled = roundIds.filter((id) => {
      const w = written.get(id);
      return !w || now.rounds.find((r) => r.id === id) === w;
    });
    now.markFlushed({ roundIds: settled, session: sessionDirty && now.session === session, bill: billDirty && now.bill === s.bill });
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
    if (changed || (state.sessionDirty && !prev.sessionDirty) || (state.billDirty && !prev.billDirty)) scheduleFlush();
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
