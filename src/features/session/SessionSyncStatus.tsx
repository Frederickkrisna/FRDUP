import { SyncBadge } from '@/components/SyncBadge';
import { useSyncStore } from '@/state/syncStore';

/**
 * Sync state on the live screens, as a thin row under the header that only exists when the host
 * has to know: offline, or a write the server refused. Normal saves and recoveries stay silent.
 */
export function SessionSyncStatus() {
  const state = useSyncStore((s) => s.state);
  const pending = useSyncStore((s) => s.pendingWrites);
  if (state !== 'offline' && state !== 'error') return null;
  return (
    <div className="mx-auto flex w-full max-w-[560px] px-4 pb-2">
      <SyncBadge state={state} pending={pending} />
    </div>
  );
}
