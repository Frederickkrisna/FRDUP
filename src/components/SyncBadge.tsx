import { Check, CloudUpload, TriangleAlert, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from './cn';

export type SyncBadgeState = 'idle' | 'syncing' | 'offline' | 'error';

const ICON = { idle: Check, syncing: CloudUpload, offline: WifiOff, error: TriangleAlert } as const;
const TONE: Record<SyncBadgeState, string> = {
  idle: 'text-success',
  syncing: 'text-info',
  offline: 'text-warning',
  error: 'text-danger',
};

/**
 * Offline is a normal state, not an error: it is a quiet warning-coloured pill with the count of
 * unflushed writes. Never a blocking dialog. Icon + text, never colour alone.
 */
export function SyncBadge({ state, pending, className }: { state: SyncBadgeState; pending: number; className?: string }) {
  const { t } = useTranslation();
  const Icon = ICON[state];
  return (
    <span
      role="status"
      className={cn('inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold', TONE[state], className)}
    >
      <Icon size={14} strokeWidth={2.25} aria-hidden="true" className={state === 'syncing' ? 'pulse-dot' : undefined} />
      <span>{t(`sync.${state}`)}</span>
      {pending > 0 ? <span className="num text-ink-muted">{pending}</span> : null}
    </span>
  );
}
