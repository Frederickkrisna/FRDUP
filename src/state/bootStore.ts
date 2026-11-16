import { create } from 'zustand';

import { logger } from '@/core/utils/logger';
import { FirebaseConfigError, currentUid, ensureSignedIn, initFirebase } from '@/data/firebase';
import { watchCarryOverWrites } from '@/data/observable';
import { useAppStore } from './appStore';
import { requestPersistentStorage } from './storage';

/**
 * - booting:        initialising Firebase / signing in silently
 * - ready:          signed in; hostId (if any) matches the anonymous uid
 * - config_error:   VITE_FIREBASE_* missing (developer problem, never a user flow)
 * - auth_failed:    no cached credential and no network on the very first launch; retries when online
 * - identity_lost:  a host was set up on this device but the anonymous uid changed (site data was
 *                   cleared / evicted). Data under the old uid is unreachable; offer backup restore.
 */
export type BootStatus = 'booting' | 'ready' | 'config_error' | 'auth_failed' | 'identity_lost';

interface BootState {
  status: BootStatus;
  uid: string | null;
  missingConfig: string[];
  start: () => Promise<void>;
  /** Abandon the unreachable identity and begin again under the new uid. */
  acceptNewIdentity: () => void;
}

let inflight: Promise<void> | null = null;

export const useBootStore = create<BootState>()((set, get) => ({
  status: 'booting',
  uid: null,
  missingConfig: [],

  start: () => {
    if (inflight) return inflight;
    inflight = (async () => {
      set({ status: 'booting' });
      try {
        initFirebase();
        const account = await ensureSignedIn();
        const { hostId } = useAppStore.getState();
        if (account && hostId !== null && hostId !== account) {
          // Sync hostId to persistent account UID
          useAppStore.getState().setHost(account, 'Fred');
        }
        // A co-host that joined as an anonymous guest keeps its uid across reloads.
        const uid = account ?? currentUid();
        set({ status: 'ready', uid });
        if (uid) {
          watchCarryOverWrites();
          void requestPersistentStorage().then((granted) => useAppStore.getState().setPersistGranted(granted));
        }
      } catch (error) {
        if (error instanceof FirebaseConfigError) {
          set({ status: 'config_error', missingConfig: error.missing });
        } else {
          logger.warn('boot sign-in failed', error);
          set({ status: 'auth_failed' });
        }
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  acceptNewIdentity: () => {
    const { uid } = get();
    useAppStore.getState().reset();
    set({ status: uid ? 'ready' : 'booting' });
    if (uid) {
      watchCarryOverWrites();
    }
  },
}));

/** Retry silently whenever connectivity returns after a failed first sign-in. */
export function installBootRetry(): () => void {
  const onOnline = () => {
    if (useBootStore.getState().status === 'auth_failed') void useBootStore.getState().start();
  };
  window.addEventListener('online', onOnline);
  return () => window.removeEventListener('online', onOnline);
}
