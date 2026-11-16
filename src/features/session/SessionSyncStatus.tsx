import { useEffect, useState } from 'react';

import { SyncBadge } from '@/components/SyncBadge';
import { useSyncStore, type SyncState } from '@/state/syncStore';

const SLOW_SYNC_MS = 1500;
const SYNCED_VISIBLE_MS = 2500;

/**
 * Sync state on the live screens, as a thin row under the header that only exists when it matters:
 * offline and failures at once, a save only when it is slow (a normal 400 ms flush must not flicker
 * on every tap), and a short "Tersinkron" when one of those clears.
 */
export function SessionSyncStatus() {
  const state = useSyncStore((s) => s.state);
  const pending = useSyncStore((s) => s.pendingWrites);
  const [shown, setShown] = useState<SyncState | null>(null);

  useEffect(() => {
    // Every update runs from a timer, never synchronously in the effect body.
    const at = (ms: number, next: (prev: SyncState | null) => SyncState | null) => {
      const id = setTimeout(() => setShown(next), ms);
      return () => clearTimeout(id);
    };
    if (state === 'offline' || state === 'error') return at(0, () => state);
    if (state === 'syncing') return at(SLOW_SYNC_MS, () => 'syncing');
    const clear = at(SYNCED_VISIBLE_MS, () => null);
    const confirm = at(0, (prev) => (prev ? 'idle' : null));
    return () => {
      clear();
      confirm();
    };
  }, [state]);

  if (!shown) return null;
  return (
    <div className="mx-auto flex w-full max-w-[560px] px-4 pb-2">
      <SyncBadge state={shown} pending={shown === 'idle' ? 0 : pending} />
    </div>
  );
}
