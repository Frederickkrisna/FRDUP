import { useRef, useState } from 'react';
import { DatabaseBackup, Download, HardDrive, RotateCcw, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TextField } from '@/components/TextField';
import { toast } from '@/components/toast/toastStore';
import { signOutDevice } from '@/data/device';
import { SyncBadge } from '@/components/SyncBadge';
import { BackupFormatError, createBackup, restoreFromBackupFile, saveBackup } from '@/features/backup/restore';
import { useAppStore } from '@/state/appStore';
import { useSessionStore } from '@/state/sessionStore';
import { useSyncStore } from '@/state/syncStore';
import { storageIsPersistent } from '@/state/storage';

const RESET_WORD = 'RESET';

export function DataSection({ hostId }: { hostId: string }) {
  const { t } = useTranslation();
  const lastBackupAt = useAppStore((s) => s.lastBackupAt);
  const persistGranted = useAppStore((s) => s.persistGranted);
  const noteBackup = useAppStore((s) => s.noteBackup);
  const syncState = useSyncStore((s) => s.state);
  const pending = useSyncStore((s) => s.pendingWrites);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<File | null>(null);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const [resetWord, setResetWord] = useState('');

  const doExport = async () => {
    setBusy('export');
    try {
      const outcome = await saveBackup(await createBackup(hostId));
      if (outcome !== 'cancelled') noteBackup();
    } catch {
      toast.danger(t('settings.data.exportFailed'));
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async (file: File) => {
    setBusy('restore');
    try {
      const counts = await restoreFromBackupFile(file);
      toast.success(t('settings.data.restoreSummary', { ...counts }));
    } catch (error) {
      toast.danger(error instanceof BackupFormatError ? t('settings.data.restoreInvalid') : t('settings.data.restoreFailed'));
    } finally {
      setBusy(null);
    }
  };

  const doReset = async () => {
    useSessionStore.getState().discard();
    window.localStorage.clear();
    await signOutDevice().catch(() => undefined);
    window.location.replace('/');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 p-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">{t('settings.data.syncStatus')}</p>
          <p className="num text-[13px] text-ink-muted">{t('settings.data.pendingWrites', { count: pending })}</p>
        </div>
        <SyncBadge state={syncState} pending={pending} />
      </div>

      <div className="flex items-start gap-3 rounded-md border border-line bg-surface-2 p-3">
        <HardDrive size={20} className={persistGranted && storageIsPersistent ? 'text-success' : 'text-warning'} aria-hidden="true" />
        <p className="text-[13px] text-ink-muted">{persistGranted && storageIsPersistent ? t('settings.data.persistOk') : t('settings.data.persistWarn')}</p>
      </div>

      <div>
        <Button fullWidth variant="secondary" loading={busy === 'export'} leftIcon={<Download size={18} aria-hidden="true" />} onClick={() => void doExport()}>
          {t('settings.data.export')}
        </Button>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-faint">
          <DatabaseBackup size={14} aria-hidden="true" />
          {lastBackupAt ? t('settings.data.lastBackup', { date: new Date(lastBackupAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }) : t('settings.data.neverBackedUp')}
        </p>
      </div>

      <Button fullWidth variant="secondary" loading={busy === 'restore'} leftIcon={<Upload size={18} aria-hidden="true" />} onClick={() => fileRef.current?.click()}>
        {t('settings.data.restore')}
      </Button>
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
          if (file) setConfirmRestore(file);
        }}
      />

      <Button fullWidth variant="ghost" className="text-danger" leftIcon={<RotateCcw size={18} aria-hidden="true" />} onClick={() => setResetStep(1)}>
        {t('settings.data.resetApp')}
      </Button>

      <ConfirmDialog
        open={confirmRestore !== null}
        title={t('settings.data.restoreConfirm')}
        body={t('settings.data.restoreDetail')}
        confirmLabel={t('settings.data.restore')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmRestore(null)}
        onConfirm={() => {
          const f = confirmRestore;
          setConfirmRestore(null);
          if (f) void doRestore(f);
        }}
      />

      <ConfirmDialog
        open={resetStep === 1}
        destructive
        title={t('settings.data.resetConfirm')}
        body={t('settings.data.resetDetail')}
        confirmLabel={t('common.next')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setResetStep(0)}
        onConfirm={() => setResetStep(2)}
      />

      <ConfirmDialog
        open={resetStep === 2}
        destructive
        title={t('settings.data.resetFinalTitle')}
        body={
          <TextField
            label={t('settings.data.resetTypeLabel', { word: RESET_WORD })}
            value={resetWord}
            onChange={(e) => setResetWord(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
          />
        }
        confirmLabel={t('settings.data.resetApp')}
        cancelLabel={t('common.cancel')}
        onCancel={() => {
          setResetStep(0);
          setResetWord('');
        }}
        onConfirm={() => {
          if (resetWord.trim().toUpperCase() === RESET_WORD) void doReset();
          else toast.warning(t('settings.data.resetWordMismatch'));
        }}
      />
    </div>
  );
}
