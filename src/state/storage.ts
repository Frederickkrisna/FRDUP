/**
 * localStorage adapter for Zustand `persist`. Synchronous, so hydration happens before first render.
 * Falls back to an in-memory map when storage is blocked (some private modes), so the app still runs.
 */

import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { logger } from '@/core/utils/logger';

const memory = new Map<string, string>();

function probe(): Storage | null {
  try {
    const key = '__frdup_probe__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return window.localStorage;
  } catch {
    return null;
  }
}

const backing = probe();
if (!backing) logger.warn('localStorage unavailable; using in-memory storage (data will not survive reload)');

export const safeStorage: StateStorage = {
  getItem: (name) => (backing ? backing.getItem(name) : (memory.get(name) ?? null)),
  setItem: (name, value) => {
    try {
      if (backing) backing.setItem(name, value);
      else memory.set(name, value);
    } catch (error) {
      // Quota exceeded: keep the in-memory copy so the running session is not interrupted.
      logger.error('storage write failed', error);
      memory.set(name, value);
    }
  },
  removeItem: (name) => {
    if (backing) backing.removeItem(name);
    memory.delete(name);
  },
};

export const jsonStorage = createJSONStorage(() => safeStorage);

/** True when data is genuinely persisted to disk. */
export const storageIsPersistent = backing !== null;

/** Request durable storage so Safari/Chrome are less eager to evict site data. Best-effort. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (error) {
    logger.warn('storage.persist failed', error);
  }
  return false;
}
