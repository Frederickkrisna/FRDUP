import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert, WifiOff } from 'lucide-react';

import { Button } from '@/components/Button';
import { toast } from '@/components/toast/toastStore';
import { useBootStore } from '@/state/bootStore';
import { restoreFromBackupFile } from '@/features/backup/restore';

function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" className={className} aria-hidden="true">
      <rect x="14" y="8" width="36" height="48" fill="none" stroke="var(--c-primary)" strokeWidth="3" />
      <line x1="10" y1="32" x2="54" y2="32" stroke="var(--c-primary)" strokeWidth="4" />
      <line x1="14" y1="20" x2="50" y2="20" stroke="var(--c-primary)" strokeWidth="2" />
      <line x1="14" y1="44" x2="50" y2="44" stroke="var(--c-primary)" strokeWidth="2" />
      <circle cx="42" cy="14" r="3.5" fill="var(--c-primary)" />
    </svg>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-[420px] flex-col items-center justify-center gap-5 px-6 text-center">
      {children}
    </main>
  );
}

/**
 * Renders the app only when it is safe to: signed in silently, and the host identity matches.
 * The other states are designed screens, never a blank page.
 */
export function BootGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const status = useBootStore((s) => s.status);
  const missing = useBootStore((s) => s.missingConfig);
  const start = useBootStore((s) => s.start);
  const acceptNewIdentity = useBootStore((s) => s.acceptNewIdentity);
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);

  if (status === 'ready') return <>{children}</>;

  if (status === 'booting') {
    return (
      <Frame>
        <BrandMark className="pulse-dot" />
        <p className="sr-only" role="status">
          {t('common.loading')}
        </p>
      </Frame>
    );
  }

  if (status === 'config_error') {
    return (
      <Frame>
        <TriangleAlert size={40} className="text-warning" aria-hidden="true" />
        <h1 className="text-[22px] font-bold">{t('boot.config.title')}</h1>
        <p className="text-[15px] text-ink-muted">{t('boot.config.body')}</p>
        <ul className="num w-full rounded-md border border-line bg-surface p-3 text-left text-[13px] text-ink-muted">
          {missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Frame>
    );
  }

  if (status === 'auth_failed') {
    return (
      <Frame>
        <WifiOff size={40} className="text-warning" aria-hidden="true" />
        <h1 className="text-[22px] font-bold">{t('boot.auth.title')}</h1>
        <p className="text-[15px] text-ink-muted">{t('boot.auth.body')}</p>
        <Button fullWidth onClick={() => void start()}>
          {t('common.retry')}
        </Button>
      </Frame>
    );
  }

  // identity_lost
  return (
    <Frame>
      <TriangleAlert size={40} className="text-warning" aria-hidden="true" />
      <h1 className="text-[22px] font-bold">{t('boot.identity.title')}</h1>
      <p className="text-[15px] text-ink-muted">{t('boot.identity.body')}</p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-label={t('settings.data.restore')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setRestoring(true);
          restoreFromBackupFile(file)
            .catch(() => toast.danger(t('settings.data.restoreFailed')))
            .finally(() => setRestoring(false));
        }}
      />
      <Button fullWidth loading={restoring} onClick={() => fileRef.current?.click()}>
        {t('boot.identity.restore')}
      </Button>
      <Button fullWidth variant="ghost" onClick={acceptNewIdentity}>
        {t('boot.identity.startFresh')}
      </Button>
    </Frame>
  );
}
