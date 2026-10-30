/** Minimal observable + write tracking shared by every repository. No RxJS. */

import { waitForPendingWrites } from 'firebase/firestore';
import { logger } from '@/core/utils/logger';
import { getDb } from './firebase';

export interface Observable<T> {
  subscribe(cb: (value: T) => void): () => void;
}

/* ---------------------------------------------------------------- pending-write tracking */

export interface WriteStatus {
  /** Writes issued in this page session that the backend has not acknowledged yet. */
  pending: number;
  /** True while a write queue left over from a previous page session is still flushing. */
  carryOver: boolean;
  /** Last permission/validation failure; the UI surfaces it as the "Gagal sinkron" badge state. */
  lastError: string | null;
}

let status: WriteStatus = { pending: 0, carryOver: false, lastError: null };
const listeners = new Set<() => void>();

function emit(next: Partial<WriteStatus>): void {
  status = { ...status, ...next };
  for (const l of listeners) l();
}

export function getWriteStatus(): WriteStatus {
  return status;
}

export function subscribeWriteStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function clearWriteError(): void {
  if (status.lastError !== null) emit({ lastError: null });
}

/**
 * Fire-and-forget a Firestore write. The promise only settles once the backend acknowledges,
 * which can be hours away when offline, so nothing in the UI may `await` it.
 */
export function track(label: string, write: Promise<unknown>): void {
  emit({ pending: status.pending + 1 });
  write
    .then(() => {
      if (status.lastError !== null && status.pending <= 1) emit({ lastError: null });
    })
    .catch((error: unknown) => {
      const code = (error as { code?: string } | null)?.code ?? 'unknown';
      logger.error(`write failed: ${label}`, code);
      emit({ lastError: `${label}:${code}` });
    })
    .finally(() => emit({ pending: Math.max(0, status.pending - 1) }));
}

/** Call once after sign-in: surfaces writes queued by a previous page session. */
export function watchCarryOverWrites(): void {
  emit({ carryOver: true });
  waitForPendingWrites(getDb())
    .catch(() => undefined)
    .finally(() => emit({ carryOver: false }));
}

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 15_000;

/**
 * Wraps onSnapshot-style subscribe functions as an Observable.
 * A Firestore listener is terminated for good by any error, and a perfectly normal startup race
 * (listening to rounds before the session document has reached the server, so the rules'
 * `get()` fails) produces one. So errors re-subscribe with exponential backoff until unsubscribed.
 */
export function observable<T>(
  start: (next: (value: T) => void, error: (e: unknown) => void) => () => void,
): Observable<T> {
  return {
    subscribe(cb) {
      let stopped = false;
      let attempt = 0;
      let stop: (() => void) | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const run = () => {
        if (stopped) return;
        stop = start(
          (value) => {
            attempt = 0;
            cb(value);
          },
          (error) => {
            const code = (error as { code?: string } | null)?.code;
            // Normal at startup (rules get() before the session doc reaches the server): retry quietly.
            logger.debug('snapshot error, will retry', code ?? error);
            stop?.();
            stop = null;
            const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt++);
            if (!stopped) timer = setTimeout(run, delay);
          },
        );
      };
      run();

      return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        stop?.();
      };
    },
  };
}
