import { BackupFormatError, backupFilename, countBackup, remapBackup, validateBackup, type BackupCounts } from '@/core/backup/backup';
import { backupRepo } from '@/data/backupRepo';
import { logger } from '@/core/utils/logger';
import { useAppStore } from '@/state/appStore';
import { useBootStore } from '@/state/bootStore';

export { BackupFormatError };

/** Reads the whole host tree (from the offline cache when needed) into a backup object. */
export async function createBackup(hostId: string) {
  return backupRepo.readAll(hostId);
}

/**
 * Saves the backup as a file. iOS Safari shares it as a file (Save to Files, AirDrop, WhatsApp);
 * everywhere else it downloads. Returns what happened so the UI can say so.
 */
export async function saveBackup(file: Awaited<ReturnType<typeof createBackup>>): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const name = backupFilename(Date.now());
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const asFile = new File([blob], name, { type: 'application/json' });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [asFile] })) {
    try {
      await navigator.share({ files: [asFile], title: name });
      return 'shared';
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return 'cancelled';
      logger.warn('share failed, downloading instead', error);
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

/**
 * Restore: validate -> re-mint under the CURRENT anonymous uid -> write -> point the app at it.
 * Used both from Settings -> Data and from the "identity lost" recovery screen.
 */
export async function restoreFromBackupFile(file: File): Promise<BackupCounts> {
  const parsed: unknown = JSON.parse(await file.text());
  const backup = validateBackup(parsed);
  const uid = useBootStore.getState().uid;
  if (!uid) throw new Error('not signed in');
  const remapped = remapBackup(backup, uid, Date.now());
  backupRepo.writeAll(uid, remapped);
  const app = useAppStore.getState();
  app.setHost(uid, remapped.host.displayName);
  app.completeOnboarding();
  app.noteBackup();
  useBootStore.setState({ status: 'ready' });
  return countBackup(remapped);
}
