import { DatabaseBackup } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { useNow } from '@/features/shared/useNow';
import { shouldRemindBackup, useAppStore } from '@/state/appStore';

/** Shown after every 10th finished session since the last backup; snoozes for a day. */
export function BackupReminder() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const finished = useAppStore((s) => s.finishedSinceBackup);
  const snoozedAt = useAppStore((s) => s.backupReminderSnoozedAt);
  const snooze = useAppStore((s) => s.snoozeBackupReminder);
  const now = useNow(60_000);

  if (!shouldRemindBackup({ finishedSinceBackup: finished, backupReminderSnoozedAt: snoozedAt }, now)) return null;

  return (
    <aside className="rise-in mx-4 mt-3 flex items-center gap-3 rounded-lg border border-warning/60 bg-surface p-4">
      <DatabaseBackup size={22} className="shrink-0 text-warning" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[14px] text-ink">{t('backup.reminder', { count: finished })}</p>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" onClick={snooze}>
          {t('backup.later')}
        </Button>
        <Button size="sm" onClick={() => void navigate('/settings#data')}>
          {t('backup.now')}
        </Button>
      </div>
    </aside>
  );
}
