import { create } from 'zustand';

import type { Id } from '@/types/common';
import type { RosterPlayerDoc } from '@/types/player';
import { rosterRepo } from '@/data/hostRosterRepo';

export type RosterStatus = 'idle' | 'loading' | 'ready' | 'error';

interface RosterState {
  players: RosterPlayerDoc[];
  status: RosterStatus;
  hostId: Id | null;
  /** Subscribes to the host's roster (cache first, then server). Returns a disposer. */
  start: (hostId: Id) => () => void;
}

/**
 * Roster is served straight from the Firestore persistent cache: the first snapshot arrives from
 * disk within milliseconds, even offline, and local writes echo back immediately.
 */
let activeDispose: (() => void) | null = null;

export const useRosterStore = create<RosterState>()((set, get) => ({
  players: [],
  status: 'idle',
  hostId: null,
  start: (hostId) => {
    activeDispose?.(); // idempotent: a retry replaces the previous listener
    if (get().hostId !== hostId) set({ players: [], status: 'loading', hostId });
    else if (get().status === 'idle') set({ status: 'loading' });
    const unsubscribe = rosterRepo.observe(hostId).subscribe((players) => set({ players, status: 'ready' }));
    // A listener error (e.g. permission) leaves status 'loading'; surface it after a grace period.
    const timer = setTimeout(() => {
      if (get().status === 'loading') set({ status: 'error' });
    }, 12_000);
    const dispose = () => {
      clearTimeout(timer);
      unsubscribe();
      if (activeDispose === dispose) activeDispose = null;
    };
    activeDispose = dispose;
    return dispose;
  },
}));

export const selectActivePlayers = (s: RosterState): RosterPlayerDoc[] => s.players.filter((p) => p.archivedAt === null);
