import { useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { RouterProvider } from 'react-router/dom';
import { useTranslation } from 'react-i18next';

import { ToastHost } from '@/components/toast/ToastHost';
import { registerPwa } from '@/features/pwa/pwa';
import { installBootRetry, useBootStore } from '@/state/bootStore';
import { installSyncStatus } from '@/state/syncStore';
import { useAppStore } from '@/state/appStore';
import { useRosterStore } from '@/state/rosterStore';
import { useSessionStore } from '@/state/sessionStore';
import { attachSessionListeners, startSessionSync } from '@/state/sync';
import { BootGate } from './BootGate';
import { router } from './router';

/** Long-lived data subscriptions that exist once a host is set up. */
function HostServices() {
  const hostId = useAppStore((s) => s.hostId);
  const start = useRosterStore((s) => s.start);
  useEffect(() => (hostId ? start(hostId) : undefined), [hostId, start]);
  return null;
}

/**
 * Session replication lives at app level, NOT in the session layout: leaving the courts screen
 * (finish, join code, bill…) must never cancel a pending flush or detach the listeners.
 */
function SessionServices() {
  const sessionId = useSessionStore((s) => s.session?.id);
  const role = useSessionStore((s) => s.role);
  useEffect(() => startSessionSync(), []);
  useEffect(() => (sessionId ? attachSessionListeners(sessionId) : undefined), [sessionId, role]);
  return null;
}

export function App() {
  const { t } = useTranslation();

  useEffect(() => {
    installSyncStatus();
    const dispose = installBootRetry();
    void useBootStore.getState().start();
    void registerPwa({
      updateMessage: t('pwa.updateAvailable'),
      updateAction: t('pwa.updateAction'),
      offlineReady: t('pwa.offlineReady'),
    });
    return dispose;
    // Run once for the app lifetime; labels are read at registration time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // `user` => animations that move things are dropped when the OS asks for reduced motion.
    <MotionConfig reducedMotion="user">
      <BootGate>
        <HostServices />
        <SessionServices />
        <RouterProvider router={router} />
      </BootGate>
      <ToastHost dismissLabel={t('common.close')} />
    </MotionConfig>
  );
}
