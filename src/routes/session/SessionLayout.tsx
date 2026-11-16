import { useEffect, useState } from 'react';
import { Flag, LayoutGrid, QrCode, ReceiptText, Settings2, Trophy, type LucideIcon } from 'lucide-react';
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
import { useSessionStore } from '@/state/sessionStore';

// Rounds are navigated on the courts screen itself (RoundStrip), so there is no rounds tab.
const TABS: Array<{ to: string; key: string; Icon: LucideIcon }> = [
  { to: 'courts', key: 'session.tabs.courts', Icon: LayoutGrid },
  { to: 'standings', key: 'session.tabs.standings', Icon: Trophy },
  { to: 'bill', key: 'session.tabs.bill', Icon: ReceiptText },
];

/** Header action with its name under the icon: an icon alone does not say what it opens. */
const HEADER_ACTION = 'pressable flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[11px] font-semibold text-ink-muted';

/** The live-session stack. Lives outside the main tabs; leaving it never ends the session. */
export function SessionLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const session = useSessionStore((s) => s.session);
  const role = useSessionStore((s) => s.role);

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
        title={active.title || t(plugin.nameKey)}
        subtitle={t('session.header.meta', { players: active.participants.filter((p) => p.leftAtRound === null).length, courts: activeCourts, elapsed: formatElapsed(active.playedAt, active.finishedAt ?? now) })}
        accent={sportAccent(active.sportId)}
        onBack={() => void navigate('/home')}
        backLabel={t('session.header.leave')}
        right={
          <>
            {role === 'host' && live ? (
              <>
                <button type="button" onClick={() => void navigate(`/session/${active.id}/join-code`)} aria-label={t('cohost.joinCode')} className={HEADER_ACTION}>
                  <QrCode size={20} className="text-ink" aria-hidden="true" />
                  <span aria-hidden="true">{t('session.header.invite')}</span>
                </button>
                <button type="button" onClick={() => setTools(true)} aria-label={t('session.tools.title')} className={HEADER_ACTION}>
                  <Settings2 size={20} className="text-ink" aria-hidden="true" />
                  <span aria-hidden="true">{t('session.header.tools')}</span>
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
        <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-[560px] grid-cols-3">
          {TABS.map(({ to, key, Icon }) => (
            <li key={to} className="contents">
              <NavLink
                to={to}
                replace
                className={({ isActive }) => cn('pressable no-select relative flex flex-col items-center justify-center gap-1 text-[12px] font-semibold', isActive ? 'text-primary' : 'text-ink-muted')}
              >
                {({ isActive }) => (
                  <>
                    <span aria-hidden="true" className={cn('absolute top-0 h-0.5 w-8 bg-primary transition-transform duration-200 ease-[var(--ease-out)] motion-reduce:transition-none', isActive ? 'scale-x-100' : 'scale-x-0')} />
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                    <span>{t(key)}</span>
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
