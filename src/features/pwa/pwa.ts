import { useEffect, useState, useSyncExternalStore } from 'react';

import { useToastStore } from '@/components/toast/toastStore';

/* ------------------------------------------------------------------ service worker */

type UpdateFn = (reloadPage?: boolean) => Promise<void>;
let updateSW: UpdateFn | null = null;
const listeners = new Set<() => void>();
let needRefresh = false;

function emit(): void {
  for (const l of listeners) l();
}

/**
 * Registers the service worker (precaches the app shell for offline use). The update is "prompt"
 * mode on purpose: a new build must never reload the page mid-session; the user taps to refresh.
 */
export async function registerPwa(labels: { updateMessage: string; updateAction: string }): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const { registerSW } = await import('virtual:pwa-register');
  updateSW = registerSW({
    immediate: true,
    // No "ready to work offline" toast: nobody needs to know, it just works.
    onNeedRefresh() {
      needRefresh = true;
      emit();
      useToastStore.getState().show({ kind: 'info', message: labels.updateMessage, actionLabel: labels.updateAction, onAction: () => void updateSW?.(true), durationMs: 10_000 });
    },
  });
}

export function useNeedRefresh(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => needRefresh,
    () => false,
  );
}

/* ---------------------------------------------------------------------- install UX */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    for (const l of installListeners) l();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    for (const l of installListeners) l();
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return (/iPad|iPhone|iPod/.test(ua) || iPadOs) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export type InstallMode = 'installed' | 'prompt' | 'ios' | 'none';

/** What the install banner should offer on this device right now. */
export function useInstallMode(): { mode: InstallMode; install: () => Promise<void> } {
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force((n) => n + 1);
    installListeners.add(cb);
    return () => {
      installListeners.delete(cb);
    };
  }, []);
  const mode: InstallMode = isStandalone() ? 'installed' : deferred ? 'prompt' : isIosSafari() ? 'ios' : 'none';
  return {
    mode,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      for (const l of installListeners) l();
    },
  };
}
