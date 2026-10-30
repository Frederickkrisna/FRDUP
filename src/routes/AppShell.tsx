import { Clock, House, Settings, Users, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';

import { InstallBanner } from '@/features/pwa/InstallBanner';
import { BackupReminder } from '@/features/backup/BackupReminder';
import { cn } from '@/components/cn';

const TABS: Array<{ to: string; key: string; Icon: LucideIcon }> = [
  { to: '/home', key: 'nav.home', Icon: House },
  { to: '/roster', key: 'nav.roster', Icon: Users },
  { to: '/history', key: 'nav.history', Icon: Clock },
  { to: '/settings', key: 'nav.settings', Icon: Settings },
];

/** Bottom tab bar app shell. No website header/footer: content scrolls, the bar stays. */
export function AppShell() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col">
      <main className="flex-1" style={{ paddingBottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 12px)' }}>
        <InstallBanner />
        <BackupReminder />
        <Outlet />
      </main>

      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur-sm"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-[560px] grid-cols-4">
          {TABS.map(({ to, key, Icon }) => (
            <li key={to} className="contents">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'pressable no-select relative flex flex-col items-center justify-center gap-1 text-[12px] font-semibold',
                    isActive ? 'text-primary' : 'text-ink-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute top-0 h-0.5 w-8 origin-center bg-primary transition-transform duration-200 ease-[var(--ease-out)] motion-reduce:transition-none',
                        isActive ? 'scale-x-100' : 'scale-x-0',
                      )}
                    />
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                    <span>{t(key)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
