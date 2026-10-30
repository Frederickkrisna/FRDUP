import { useEffect, useState } from 'react';
import { Flag, QrCode, Settings2 } from 'lucide-react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { cn } from '@/components/cn';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/Button';
import { getSportPlugin } from '@/core/sports/registry';
import { formatElapsed } from '@/core/utils/date';
import { SessionToolsSheet } from '@/features/session/SessionToolsSheet';
import { useWakeLock } from '@/features/session/useWakeLock';
import { sportAccent } from '@/features/shared/sportMeta';
import { selectCurrentRound, useSessionStore } from '@/state/sessionStore';

const TABS = [
  { to: 'courts', key: 'session.tabs.courts' },
  { to: 'standings', key: 'session.tabs.standings' },
  { to: 'rounds', key: 'session.tabs.rounds' },
  { to: 'bill', key: 'session.tabs.bill' },
] as const;

/** The live-session stack. Lives outside the main tabs; leaving it never ends the session. */
export function SessionLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const session = useSessionStore((s) => s.session);
  const role = useSessionStore((s) => s.role);
  const round = useSessionStore(selectCurrentRound);

  const [tools, setTools] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const active = session?.id === sessionId ? session : null;
  const live = active?.status === 'live' || active?.status === 'paused';

  useWakeLock(live);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    document.documentElement.style.setProperty('--toast-bottom', 'calc(var(--tabbar-h) + 84px)');
    return () => {
      clearInterval(id);
      document.documentElement.style.removeProperty('--toast-bottom');
    };
  }, []);

  if (!active) {
    return (
      <main className="pt-safe mx-auto flex min-h-dvh max-w-[560px] items-center">
        <EmptyState
          art="court"
          title={t('session.notFound.title')}
          body={t('session.notFound.body')}
          action={
            <Button fullWidth onClick={() => void navigate('/home', { replace: true })}>
              {t('error.route.home')}
            </Button>
          }
        />
      </main>
    );
  }

  const plugin = getSportPlugin(active.sportId);
  const activeCourts = active.courts.filter((c) => c.isActive).length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col">
      <ScreenHeader
        title={t('session.header.title', { sport: t(plugin.nameKey), round: round?.roundNumber ?? 1 })}
        subtitle={t('session.header.meta', { players: active.participants.filter((p) => p.leftAtRound === null).length, courts: activeCourts, elapsed: formatElapsed(active.playedAt, active.finishedAt ?? now) })}
        accent={sportAccent(active.sportId)}
        onBack={() => void navigate('/home')}
        backLabel={t('session.header.leave')}
        right={
          <>
            {role === 'host' && live ? (
              <>
                <button type="button" onClick={() => void navigate(`/session/${active.id}/join-code`)} aria-label={t('cohost.joinCode')} className="pressable grid size-11 place-items-center rounded-full text-ink">
                  <QrCode size={20} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setTools(true)} aria-label={t('session.tools.title')} className="pressable grid size-11 place-items-center rounded-full text-ink">
                  <Settings2 size={20} aria-hidden="true" />
                </button>
              </>
            ) : null}
          </>
        }
      />

      {active.status === 'finished' ? (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-lg border border-success bg-surface p-3">
          <p className="text-[14px] font-semibold text-success">{t('session.finishedBanner')}</p>
          <Button size="sm" variant="secondary" leftIcon={<Flag size={16} aria-hidden="true" />} onClick={() => void navigate(`/session/${active.id}/finish`)}>
            {t('session.finishedCta')}
          </Button>
        </div>
      ) : null}

      <main className="flex-1" style={{ paddingBottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 96px)' }}>
        <Outlet />
      </main>

      <nav aria-label={t('session.tabs.label')} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur-sm" style={{ paddingBottom: 'var(--safe-bottom)' }}>
        <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-[560px] grid-cols-4">
          {TABS.map(({ to, key }) => (
            <li key={to} className="contents">
              <NavLink
                to={to}
                replace
                className={({ isActive }) => cn('pressable no-select relative flex items-center justify-center text-[14px] font-bold', isActive ? 'text-primary' : 'text-ink-muted')}
              >
                {({ isActive }) => (
                  <>
                    <span aria-hidden="true" className={cn('absolute top-0 h-0.5 w-10 bg-primary transition-transform duration-200 ease-[var(--ease-out)] motion-reduce:transition-none', isActive ? 'scale-x-100' : 'scale-x-0')} />
                    {t(key)}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <SessionToolsSheet open={tools} onClose={() => setTools(false)} />
    </div>
  );
}
