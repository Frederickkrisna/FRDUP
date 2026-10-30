import { ArrowRight, Play, Trophy } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonRows } from '@/components/Skeleton';
import { formatElapsed } from '@/core/utils/date';
import { selectCurrentRound, useSessionStore } from '@/state/sessionStore';
import { SessionRow } from '@/features/history/SessionRow';
import { useSessionHistory } from '@/features/history/useSessionHistory';
import { SportIcon, allSports, sportAccent } from '@/features/shared/sportMeta';
import { useSetupDraft } from '@/features/shared/people';
import { useNow } from '@/features/shared/useNow';
import { useAppStore } from '@/state/appStore';
import { getSportPlugin } from '@/core/sports/registry';

function ResumeBanner() {
  const { t } = useTranslation();
  const session = useSessionStore((s) => s.session);
  const round = useSessionStore(selectCurrentRound);
  const now = useNow(30_000);

  if (!session || (session.status !== 'live' && session.status !== 'paused')) return null;
  const plugin = getSportPlugin(session.sportId);
  return (
    <Link
      to={`/session/${session.id}/courts`}
      className="pressable rise-in flex items-center gap-3 rounded-lg border border-primary bg-surface-2 p-4"
      aria-label={t('home.resumeBanner.aria', { sport: t(plugin.nameKey) })}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-md bg-surface-3" style={{ color: sportAccent(session.sportId) }}>
        <SportIcon name={plugin.icon} size={24} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-primary">{t('home.resumeBanner.title')}</p>
        <p className="truncate text-[17px] font-bold">{session.title || t(plugin.nameKey)}</p>
        <p className="num truncate text-[13px] text-ink-muted">
          {t('home.resumeBanner.meta', { round: round?.roundNumber ?? 1, elapsed: formatElapsed(session.playedAt, now) })}
        </p>
      </div>
      <span className="inline-flex min-h-11 items-center gap-1 rounded-md bg-primary px-4 text-[15px] font-bold text-primary-on">
        <Play size={16} fill="currentColor" aria-hidden="true" />
        {t('home.resumeBanner.cta')}
      </span>
    </Link>
  );
}

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hostId = useAppStore((s) => s.hostId);
  const hostName = useAppStore((s) => s.hostName);
  const lastSport = useAppStore((s) => s.lastSportId);
  const live = useSessionStore((s) => s.session?.status === 'live' || s.session?.status === 'paused');
  const resetDraft = useSetupDraft((s) => s.reset);
  const patchDraft = useSetupDraft((s) => s.patch);
  const { sessions, status, reload } = useSessionHistory(hostId, null, 3);

  const startSession = () => {
    resetDraft();
    if (lastSport) patchDraft({ sportId: lastSport });
    void navigate('/session/setup');
  };

  return (
    <div className="pt-safe flex flex-col gap-6 px-4 pb-4">
      <header className="flex items-start justify-between pt-6">
        <div className="min-w-0">
          <p className="text-[15px] text-ink-muted">{t('home.greeting')}</p>
          <h1 className="truncate text-[32px] font-extrabold leading-tight">{hostName || t('common.appName')}</h1>
        </div>
      </header>

      <ResumeBanner />

      {!live ? (
        <Button size="lg" fullWidth onClick={startSession} leftIcon={<Play size={18} fill="currentColor" aria-hidden="true" />}>
          {t('home.newSession')}
        </Button>
      ) : null}

      <section aria-labelledby="home-recent">
        <div className="mb-1 flex items-center justify-between">
          <h2 id="home-recent" className="text-[17px] font-bold">
            {t('home.recentSessions')}
          </h2>
          <Link to="/history" className="pressable inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-ink-muted">
            {t('home.seeAll')}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {status === 'loading' ? (
          <SkeletonRows count={3} />
        ) : sessions.length === 0 ? (
          <EmptyState art="court" title={t('home.noSessions')} body={t('home.noSessionsBody')} />
        ) : status === 'error' ? (
          <EmptyState art="sessions" title={t('history.error.title')} action={<Button onClick={reload}>{t('common.retry')}</Button>} />
        ) : (
          <ul className="flex flex-col">
            {sessions.map((s, i) => (
              <SessionRow key={s.id} session={s} index={i} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="home-boards">
        <h2 id="home-boards" className="mb-2 flex items-center gap-2 text-[17px] font-bold">
          <Trophy size={18} className="text-ink-muted" aria-hidden="true" />
          {t('home.leaderboards')}
        </h2>
        <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {allSports().map((s) => {
            return (
              <Link key={s.id} to={`/leaderboard/${s.id}`} className="pressable pressable-hover inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-4 text-[15px] font-semibold">
                <SportIcon name={s.icon} size={18} style={{ color: sportAccent(s.id) }} aria-hidden="true" />
                {t(s.nameKey)}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
