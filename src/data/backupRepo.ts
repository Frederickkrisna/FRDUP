/** Bulk read/write of a host's whole data tree, for JSON backup & restore. */

import { getDoc, getDocs, limit, orderBy, query, startAfter, where, writeBatch, type DocumentReference, type Query, type QueryDocumentSnapshot, type QuerySnapshot, type DocumentData } from 'firebase/firestore';

import type { Id } from '@/types/common';
import type { HostDoc } from '@/types/host';
import type { PlayerSessionResultDoc, PlayerSportStatsDoc, RosterPlayerDoc } from '@/types/player';
import type { RoundDoc } from '@/types/round';
import type { SessionDoc } from '@/types/session';
import type { BillDoc } from '@/types/bill';
import type { RpEventDoc } from '@/types/stats';
import type { BackupFile, BackupPlayer, BackupSession } from '@/core/backup/backup';
import { BACKUP_APP, BACKUP_FORMAT_VERSION } from '@/core/backup/backup';
import { getDb } from './firebase';
import { decode, encode } from './converters';
import { track } from './observable';
import { paths } from './paths';

const SPORTS = ['padel', 'badminton', 'pingpong', 'billiard', 'mahjong'] as const;
const BATCH_SIZE = 400;

async function readPlayer(hostId: Id, doc: RosterPlayerDoc): Promise<BackupPlayer> {
  const [statSnaps, resultSnap, eventSnap] = await Promise.all([
    Promise.all(SPORTS.map((s) => getDoc(paths.sportStats(hostId, doc.id, s)))),
    getDocs(paths.sessionResults(hostId, doc.id)),
    getDocs(paths.rpEvents(hostId, doc.id)),
  ]);
  return {
    doc,
    stats: statSnaps.filter((s) => s.exists()).map((s) => decode<PlayerSportStatsDoc>(s.data())),
    results: resultSnap.docs.map((d) => decode<PlayerSessionResultDoc>(d.data())),
    events: eventSnap.docs.map((d) => decode<RpEventDoc>(d.data())),
  };
}

async function readSessions(hostId: Id): Promise<BackupSession[]> {
  const out: BackupSession[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  for (;;) {
    const q: Query<DocumentData> = query(paths.sessions(), where('hostId', '==', hostId), orderBy('playedAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(50));
    const snap: QuerySnapshot<DocumentData> = await getDocs(q);
    if (snap.empty) break;
    for (const d of snap.docs) {
      const doc = decode<SessionDoc>(d.data());
      const [roundsSnap, billSnap] = await Promise.all([getDocs(paths.rounds(doc.id)), getDoc(paths.bill(doc.id))]);
      const rounds = roundsSnap.docs.map((r) => decode<RoundDoc>(r.data())).sort((a, b) => a.roundNumber - b.roundNumber);
      out.push({ doc, rounds, bill: billSnap.exists() ? decode<BillDoc>(billSnap.data()) : null });
    }
    cursor = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.docs.length < 50) break;
  }
  return out;
}

export const backupRepo = {
  async readAll(hostId: Id): Promise<BackupFile> {
    const hostSnap = await getDoc(paths.host(hostId));
    if (!hostSnap.exists()) throw new Error('host document not found');
    const rosterSnap = await getDocs(paths.roster(hostId));
    const docs = rosterSnap.docs.map((d) => decode<RosterPlayerDoc>(d.data()));
    const [players, sessions] = await Promise.all([Promise.all(docs.map((d) => readPlayer(hostId, d))), readSessions(hostId)]);
    return {
      app: BACKUP_APP,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: Date.now(),
      host: decode<HostDoc>(hostSnap.data()),
      players,
      sessions,
    };
  },

  /** Writes a (re-minted) backup in 400-op batches. Fire-and-forget: it lands in the local cache first. */
  writeAll(uid: Id, file: BackupFile): void {
    const ops: Array<{ ref: DocumentReference; data: DocumentData }> = [];
    ops.push({ ref: paths.host(uid), data: encode(file.host) });
    for (const p of file.players) {
      ops.push({ ref: paths.player(uid, p.doc.id), data: encode(p.doc) });
      for (const s of p.stats) ops.push({ ref: paths.sportStats(uid, p.doc.id, s.sportId), data: encode(s) });
      for (const r of p.results) ops.push({ ref: paths.sessionResult(uid, p.doc.id, r.sessionId), data: encode(r) });
      for (const e of p.events) ops.push({ ref: paths.rpEvent(uid, p.doc.id, e.id), data: encode(e) });
    }
    for (const s of file.sessions) {
      ops.push({ ref: paths.session(s.doc.id), data: encode(s.doc) });
      for (const r of s.rounds) ops.push({ ref: paths.round(s.doc.id, r.id), data: encode(r) });
      if (s.bill) ops.push({ ref: paths.bill(s.doc.id), data: encode(s.bill) });
    }
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      const batch = writeBatch(getDb());
      for (const op of ops.slice(i, i + BATCH_SIZE)) batch.set(op.ref, op.data);
      track('backup.restore', batch.commit());
    }
  },
};
