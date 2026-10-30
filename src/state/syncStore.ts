import { create } from 'zustand';

import type { CoHostDoc } from '@/types/stats';
import { getWriteStatus, subscribeWriteStatus } from '@/data/observable';

/** What the SyncBadge shows. Offline is a normal state, not an error (docs/design.md §7.2). */
export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

interface SyncStoreState {
  online: boolean;
  pendingWrites: number;
  hasError: boolean;
  state: SyncState;
  /** Registered co-host devices for the active session (host side). */
  coHosts: CoHostDoc[];
  setCoHosts: (coHosts: CoHostDoc[]) => void;
}

function derive(online: boolean, pending: number, hasError: boolean): SyncState {
  if (!online) return 'offline';
  if (hasError) return 'error';
  return pending > 0 ? 'syncing' : 'idle';
}

export const useSyncStore = create<SyncStoreState>()((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  pendingWrites: 0,
  hasError: false,
  state: 'idle',
  coHosts: [],
  setCoHosts: (coHosts) => set({ coHosts }),
}));

let installed = false;

/** Wire browser connectivity + Firestore write tracking into the store. Idempotent. */
export function installSyncStatus(): void {
  if (installed) return;
  installed = true;
  const refresh = () => {
    const w = getWriteStatus();
    const { online } = useSyncStore.getState();
    const pending = w.pending + (w.carryOver ? 1 : 0);
    useSyncStore.setState({ pendingWrites: pending, hasError: w.lastError !== null, state: derive(online, pending, w.lastError !== null) });
  };
  subscribeWriteStatus(refresh);
  const setOnline = (online: boolean) => {
    useSyncStore.setState({ online });
    refresh();
  };
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
  refresh();
}
