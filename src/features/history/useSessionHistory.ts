import { useCallback, useEffect, useRef, useState } from 'react';

import type { Id } from '@/types/common';
import type { SessionDoc } from '@/types/session';
import type { SportId } from '@/types/sport';
import { sessionRepo } from '@/data/sessionRepo';

const PAGE = 20;

export interface HistoryState {
  sessions: SessionDoc[];
  status: 'loading' | 'ready' | 'error';
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

/** Cursor-paginated session history (newest first). Only finished sessions are listed. */
export function useSessionHistory(hostId: Id | null, sportId: SportId | null, pageSize: number = PAGE): HistoryState {
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [status, setStatus] = useState<HistoryState['status']>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursor = useRef<number | undefined>(undefined);
  const generation = useRef(0);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!hostId) return;
      const gen = reset ? ++generation.current : generation.current;
      try {
        const page = await sessionRepo.listByHost(hostId, {
          limit: pageSize,
          sportId: sportId ?? undefined,
          cursor: reset ? undefined : cursor.current,
        });
        if (gen !== generation.current) return; // a newer request superseded this one
        const finished = page.filter((s) => s.status === 'finished');
        cursor.current = page.at(-1)?.playedAt;
        setSessions((prev) => (reset ? finished : [...prev, ...finished]));
        setHasMore(page.length === pageSize);
        setStatus('ready');
      } catch {
        if (gen === generation.current) setStatus('error');
      } finally {
        if (gen === generation.current) setLoadingMore(false);
      }
    },
    [hostId, sportId, pageSize],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the list when the filter changes
    setStatus('loading');
    void fetchPage(true);
  }, [fetchPage]);

  return {
    sessions,
    status,
    hasMore,
    loadingMore,
    loadMore: () => {
      if (loadingMore || !hasMore) return;
      setLoadingMore(true);
      void fetchPage(false);
    },
    reload: () => {
      setStatus('loading');
      void fetchPage(true);
    },
  };
}
