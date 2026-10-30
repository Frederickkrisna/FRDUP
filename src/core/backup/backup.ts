/**
 * Backup & restore (docs/implementation_be.md §2.2). Identity is the anonymous uid, which is lost when
 * the browser's site data is cleared; a JSON backup is the recovery path. Restore RE-MINTS everything
 * under the new uid: host id, session ids, and every reference to them.
 * Pure TypeScript: reading/writing Firestore lives in src/data/backupRepo.ts.
 */

import type { Id, Millis } from '@/types/common';
import type { BillDoc } from '@/types/bill';
import type { HostDoc } from '@/types/host';
import type { PlayerSessionResultDoc, PlayerSportStatsDoc, RosterPlayerDoc } from '@/types/player';
import type { RoundDoc } from '@/types/round';
import type { SessionDoc } from '@/types/session';
import type { RpEventDoc } from '@/types/stats';
import { createId } from '@/core/utils/id';

export const BACKUP_APP = 'frdup';
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupPlayer {
  doc: RosterPlayerDoc;
  stats: PlayerSportStatsDoc[];
  results: PlayerSessionResultDoc[];
  events: RpEventDoc[];
}

export interface BackupSession {
  doc: SessionDoc;
  rounds: RoundDoc[];
  bill: BillDoc | null;
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  formatVersion: number;
  exportedAt: Millis;
  host: HostDoc;
  players: BackupPlayer[];
  sessions: BackupSession[];
}

export class BackupFormatError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid backup: ${reason}`);
    this.name = 'BackupFormatError';
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Structural validation of an untrusted JSON file. Throws BackupFormatError with a reason. */
export function validateBackup(input: unknown): BackupFile {
  if (!isObj(input)) throw new BackupFormatError('not an object');
  if (input['app'] !== BACKUP_APP) throw new BackupFormatError('not a FRDUP backup');
  const version = input['formatVersion'];
  if (typeof version !== 'number' || version > BACKUP_FORMAT_VERSION) throw new BackupFormatError('unsupported version');
  if (!isObj(input['host']) || typeof input['host']['displayName'] !== 'string') throw new BackupFormatError('missing host');
  const players = input['players'];
  const sessions = input['sessions'];
  if (!Array.isArray(players) || !Array.isArray(sessions)) throw new BackupFormatError('missing lists');

  for (const p of players) {
    if (!isObj(p) || !isObj(p['doc']) || typeof p['doc']['id'] !== 'string' || typeof p['doc']['name'] !== 'string') {
      throw new BackupFormatError('bad player');
    }
    for (const k of ['stats', 'results', 'events']) if (!Array.isArray(p[k])) throw new BackupFormatError(`bad player.${k}`);
  }
  for (const s of sessions) {
    if (!isObj(s) || !isObj(s['doc']) || typeof s['doc']['id'] !== 'string' || !Array.isArray(s['rounds'])) {
      throw new BackupFormatError('bad session');
    }
  }
  return input as unknown as BackupFile;
}

export interface BackupCounts {
  players: number;
  sessions: number;
  rounds: number;
  results: number;
  events: number;
}

export function countBackup(file: BackupFile): BackupCounts {
  return {
    players: file.players.length,
    sessions: file.sessions.length,
    rounds: file.sessions.reduce((n, s) => n + s.rounds.length, 0),
    results: file.players.reduce((n, p) => n + p.results.length, 0),
    events: file.players.reduce((n, p) => n + p.events.length, 0),
  };
}

/**
 * Re-mint under a new owner uid. Players keep their ids (they live under hosts/{uid}/…, so there is
 * no collision); sessions get new ids because sessions are a top-level collection that the old uid
 * may still own on another device.
 */
export function remapBackup(file: BackupFile, uid: Id, now: Millis): BackupFile {
  const sessionIds = new Map<Id, Id>(file.sessions.map((s) => [s.doc.id, createId()]));
  const sid = (old: Id): Id => sessionIds.get(old) ?? old;

  return {
    ...file,
    exportedAt: now,
    host: { ...file.host, id: uid, anonUid: uid, updatedAt: now },
    players: file.players.map((p) => ({
      doc: { ...p.doc, hostId: uid },
      stats: p.stats,
      results: p.results.map((r) => ({ ...r, id: sid(r.sessionId), sessionId: sid(r.sessionId) })),
      events: p.events.map((e) => ({ ...e, sessionId: e.sessionId === null ? null : sid(e.sessionId) })),
    })),
    sessions: file.sessions.map((s) => {
      const newId = sid(s.doc.id);
      return {
        doc: {
          ...s.doc,
          id: newId,
          hostId: uid,
          hostAnonUid: uid,
          // Join codes belong to the old uid's lookup docs; a restored session starts closed.
          joinCode: null,
          joinCodeExpiresAt: null,
          coHostCount: 0,
          billId: s.doc.billId,
        },
        rounds: s.rounds.map((r) => ({ ...r, sessionId: newId, lastWriterUid: uid })),
        bill: s.bill ? { ...s.bill, sessionId: newId, hostId: uid } : null,
      };
    }),
  };
}

export function backupFilename(now: Millis): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `frdup-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}
