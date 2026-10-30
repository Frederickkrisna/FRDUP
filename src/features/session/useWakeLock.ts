import { useEffect, useRef } from 'react';
import { logger } from '@/core/utils/logger';

/**
 * Screen Wake Lock for the whole live session (the scoreboard must not dim mid-rally).
 * Feature-detected; re-acquired when the tab becomes visible again (the lock is released on hide).
 */
export function useWakeLock(active: boolean): void {
  const lock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let cancelled = false;

    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release();
          return;
        }
        lock.current = sentinel;
      } catch (error) {
        // Denied (battery saver, no user gesture yet): the session still works, the screen may dim.
        logger.warn('wake lock unavailable', (error as { name?: string }).name);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock.current?.release();
      lock.current = null;
    };
  }, [active]);
}
