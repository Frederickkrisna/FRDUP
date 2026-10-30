/**
 * Wire <-> domain conversion at the repository boundary.
 *  - Domain code works in epoch millis; Firestore stores Timestamps (api_contract.md §1).
 *  - Firestore forbids arrays directly inside arrays, so `Match.teams` (Id[][]) is stored as
 *    `[{ ids: [...] }, ...]` and restored on read (api_contract.md §12, v1.1.0).
 */

import { Timestamp, type DocumentData } from 'firebase/firestore';

/** Every persisted field that holds a point in time. */
const TIME_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'archivedAt',
  'playedAt',
  'finishedAt',
  'plannedEndAt',
  'joinCodeExpiresAt',
  'expiresAt',
  'joinedAt',
  'lastSeenAt',
  'startedAt',
  'completedAt',
  'lastPlayedAt',
]);

/** Fields that are arrays of arrays in the domain model. */
const NESTED_ARRAY_KEYS = new Set(['teams']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Timestamp);
}

/** Domain -> Firestore. Numbers under a time key become Timestamps; undefined is dropped. */
export function encode<T extends object>(doc: T): DocumentData {
  const walk = (value: unknown, key?: string): unknown => {
    if (value === undefined) return undefined;
    if (key && TIME_KEYS.has(key) && typeof value === 'number') return Timestamp.fromMillis(value);
    if (Array.isArray(value)) {
      if (key && NESTED_ARRAY_KEYS.has(key) && value.every(Array.isArray)) return value.map((inner) => ({ ids: inner.map((v) => walk(v)) }));
      return value.map((v) => walk(v));
    }
    if (isPlainObject(value)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        const w = walk(v, k);
        if (w !== undefined) out[k] = w;
      }
      return out;
    }
    return value;
  };
  return walk(doc) as DocumentData;
}

/** Firestore -> domain. Timestamps become epoch millis; wrapped nested arrays are unwrapped. */
export function decode<T>(data: DocumentData): T {
  const walk = (value: unknown, key?: string): unknown => {
    if (value instanceof Timestamp) return value.toMillis();
    if (Array.isArray(value)) {
      if (key && NESTED_ARRAY_KEYS.has(key) && value.every((v) => isPlainObject(v) && Array.isArray(v['ids']))) {
        return value.map((v) => (v as { ids: unknown[] }).ids.map((x) => walk(x)));
      }
      return value.map((v) => walk(v));
    }
    if (isPlainObject(value)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) out[k] = walk(v, k);
      return out;
    }
    return value;
  };
  return walk(data) as T;
}
