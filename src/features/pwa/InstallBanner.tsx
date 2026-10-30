import { Share, SquarePlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { useNow } from '@/features/shared/useNow';
import { useAppStore } from '@/state/appStore';
import { useInstallMode } from './pwa';

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Install nudge. Android/Chrome: one-tap install via beforeinstallprompt. iOS Safari has no install
 * prompt, so it shows the Share -> Add to Home Screen steps. Dismissible; returns after a week.
 * It matters for data safety too: an installed PWA is far less likely to be evicted by Safari.
 */
export function InstallBanner() {
  const { t } = useTranslation();
  const { mode, install } = useInstallMode();
  const dismissedAt = useAppStore((s) => s.installDismissedAt);
  const dismiss = useAppStore((s) => s.dismissInstall);
  const onboarded = useAppStore((s) => s.onboardingComplete);
  const now = useNow(60_000);

  if (!onboarded || mode === 'installed' || mode === 'none') return null;
  if (dismissedAt !== null && now - dismissedAt < SNOOZE_MS) return null;

  return (
    <aside aria-label={t('pwa.install.title')} className="rise-in mx-4 mt-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{t('pwa.install.title')}</p>
          {mode === 'ios' ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-ink-muted">
              <span>{t('pwa.install.iosStep1')}</span>
              <Share size={15} aria-label={t('pwa.install.shareIcon')} className="text-info" />
              <span>{t('pwa.install.iosStep2')}</span>
              <SquarePlus size={15} aria-label={t('pwa.install.addIcon')} className="text-info" />
              <span>{t('pwa.install.iosStep3')}</span>
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-ink-muted">{t('pwa.install.body')}</p>
          )}
        </div>
        <button type="button" onClick={dismiss} aria-label={t('common.close')} className="pressable grid size-11 shrink-0 place-items-center rounded-full text-ink-faint">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {mode === 'prompt' ? (
        <Button size="sm" className="mt-3" onClick={() => void install()}>
          {t('pwa.install.cta')}
        </Button>
      ) : null}
    </aside>
  );
}
