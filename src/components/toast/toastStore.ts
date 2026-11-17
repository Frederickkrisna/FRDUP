import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'warning' | 'danger';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** e.g. "Urungkan" — runs once, then the toast closes. */
  actionLabel?: string;
  onAction?: () => void;
  durationMs: number;
  /** A new toast with the same key replaces the old one instead of stacking. */
  key?: string;
}

interface ToastState {
  items: ToastItem[];
  show: (t: Omit<ToastItem, 'id' | 'durationMs'> & { durationMs?: number }) => number;
  dismiss: (id: number) => void;
}

let seq = 0;
const MAX_VISIBLE = 3;

export const useToastStore = create<ToastState>()((set) => ({
  items: [],
  show: (t) => {
    const id = ++seq;
    set((s) => ({ items: [...s.items.filter((i) => !t.key || i.key !== t.key), { durationMs: 5000, ...t, id }].slice(-MAX_VISIBLE) }));
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

/** Imperative API for features: `toast.success('Tersimpan')`, `toast.undo('Skor dibatalkan', 'Urungkan', fn)`. */
export const toast = {
  info: (message: string) => useToastStore.getState().show({ kind: 'info', message }),
  success: (message: string) => useToastStore.getState().show({ kind: 'success', message }),
  warning: (message: string) => useToastStore.getState().show({ kind: 'warning', message }),
  danger: (message: string) => useToastStore.getState().show({ kind: 'danger', message }),
  undo: (message: string, actionLabel: string, onAction: () => void) =>
    // Undo only ever reverts the latest step, so one undo toast at a time.
    useToastStore.getState().show({ kind: 'info', message, actionLabel, onAction, durationMs: 4000, key: 'undo' }),
};
