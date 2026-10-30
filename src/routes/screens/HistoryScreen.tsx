import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonRows } from '@/components/Skeleton';
import { SessionRow } from '@/features/history/SessionRow';
import { useSessionHistory } from '@/features/history/useSessionHistory';
import { allSports, sportAccent } from '@/features/shared/sportMeta';
import { useAppStore } from '@/state/appStore';
import type { SportId } from '@/types/sport';

const monthFmt = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });

export function HistoryScreen() {
  const { t } = useTranslation();
  const hostId = useAppStore((s) => s.hostId);
  const [sportId, setSportId] = useState<SportId | null>(null);
  const { sessions, status, hasMore, loadingMore, loadMore, reload } = useSessionHistory(hostId, sportId);

  const groups = useMemo(() => {
    const out: Array<{ month: string; items: typeof sessions }> = [];
    for (const s of sessions) {
      const month = monthFmt.format(s.playedAt);
      const last = out.at(-1);
      if (last && last.month === month) last.items.push(s);
      else out.push({ month, items: [s] });
    }
    return out;
  }, [sessions]);

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: '240px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="pt-safe px-4 pb-4">
      <h1 className="pb-3 pt-6 text-[32px] font-extrabold leading-none">{t('history.title')}</h1>

      <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label={t('history.filterBySport')}>
        <Chip selected={sportId === null} onClick={() => setSportId(null)}>
          {t('common.allSports')}
        </Chip>
        {allSports().map((s) => (
          <Chip key={s.id} selected={sportId === s.id} accent={sportAccent(s.id)} onClick={() => setSportId(s.id)}>
            {t(s.nameKey)}
          </Chip>
        ))}
      </div>

      <section className="mt-4" aria-busy={status === 'loading'}>
        {status === 'loading' ? (
          <SkeletonRows count={5} />
        ) : groups.length === 0 ? (
          <EmptyState art="sessions" title={t('history.empty')} body={t('history.emptyBody')} />
        ) : status === 'error' ? (
          <EmptyState art="sessions" title={t('history.error.title')} body={t('history.error.body')} action={<Button onClick={reload}>{t('common.retry')}</Button>} />
        ) : (
          groups.map((g) => (
            <div key={g.month} className="mb-4">
              <h2 className="sticky top-0 z-10 bg-bg py-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{g.month}</h2>
              <ul className="flex flex-col">
                {g.items.map((s, i) => (
                  <SessionRow key={s.id} session={s} index={i} />
                ))}
              </ul>
            </div>
          ))
        )}
        <div ref={sentinel} className="h-px" aria-hidden="true" />
        {loadingMore ? <SkeletonRows count={2} className="mt-2" /> : null}
        {hasMore && status === 'ready' && !loadingMore ? (
          <Button variant="secondary" fullWidth onClick={loadMore} className="mt-2">
            {t('history.loadMore')}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
