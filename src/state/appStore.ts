import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Id, Millis } from '@/types/common';
import type { SportId } from '@/types/sport';
import { jsonStorage } from './storage';

export interface AppState {
  /** Equals the anonymous auth uid once onboarding created the host doc. */
  hostId: Id | null;
  hostName: string;
  locale: 'id' | 'en';
  defaultSportId: SportId | null;
  onboardingComplete: boolean;
  /** Last sport chosen anywhere; preselected on setup screens. */
  lastSportId: SportId | null;

  /* Install + data-safety nudges */
  installDismissedAt: Millis | null;
  persistGranted: boolean;
  lastBackupAt: Millis | null;
  finishedSinceBackup: number;
  backupReminderSnoozedAt: Millis | null;

  setHost: (hostId: Id, hostName: string) => void;
  setHostName: (name: string) => void;
  setLocale: (locale: 'id' | 'en') => void;
  setDefaultSport: (sportId: SportId) => void;
  setLastSport: (sportId: SportId) => void;
  completeOnboarding: () => void;
  dismissInstall: () => void;
  setPersistGranted: (granted: boolean) => void;
  noteSessionFinished: () => void;
  noteBackup: () => void;
  snoozeBackupReminder: () => void;
  reset: () => void;
}

const initial = {
  hostId: null,
  hostName: '',
  locale: 'id' as const,
  defaultSportId: null,
  onboardingComplete: false,
  lastSportId: null,
  installDismissedAt: null,
  persistGranted: false,
  lastBackupAt: null,
  finishedSinceBackup: 0,
  backupReminderSnoozedAt: null,
};

export const BACKUP_REMINDER_EVERY = 10;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initial,
      setHost: (hostId, hostName) => set({ hostId, hostName }),
      setHostName: (hostName) => set({ hostName }),
      setLocale: (locale) => set({ locale }),
      setDefaultSport: (defaultSportId) => set({ defaultSportId, lastSportId: defaultSportId }),
      setLastSport: (lastSportId) => set({ lastSportId }),
      completeOnboarding: () => set({ onboardingComplete: true }),
      dismissInstall: () => set({ installDismissedAt: Date.now() }),
      setPersistGranted: (persistGranted) => set({ persistGranted }),
      noteSessionFinished: () => set((s) => ({ finishedSinceBackup: s.finishedSinceBackup + 1 })),
      noteBackup: () => set({ lastBackupAt: Date.now(), finishedSinceBackup: 0, backupReminderSnoozedAt: null }),
      snoozeBackupReminder: () => set({ backupReminderSnoozedAt: Date.now() }),
      reset: () => set({ ...initial }),
    }),
    { name: 'frdup.app', storage: jsonStorage, version: 1 },
  ),
);

/** Backup nudge: every 10th finished session since the last backup, unless snoozed in the last day. */
export function shouldRemindBackup(s: Pick<AppState, 'finishedSinceBackup' | 'backupReminderSnoozedAt'>, now: Millis): boolean {
  if (s.finishedSinceBackup < BACKUP_REMINDER_EVERY) return false;
  return s.backupReminderSnoozedAt === null || now - s.backupReminderSnoozedAt > 24 * 60 * 60 * 1000;
}
