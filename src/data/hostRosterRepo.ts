/** host + roster repositories. Writes are local-first and never awaited by the UI (see observable.ts). */

import {
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';

import type { Id } from '@/types/common';
import type { HostDoc } from '@/types/host';
import type { NewPlayerInput, RosterPlayerDoc } from '@/types/player';
import { avatarColorFor } from '@/core/utils/avatar';
import { createId } from '@/core/utils/id';
import { SCHEMA_VERSION } from '@/core/session/sessionEngine';
import { getDb } from './firebase';
import { decode, encode } from './converters';
import { observable, track, type Observable } from './observable';
import { paths } from './paths';

/* ------------------------------------------------------------------------------ host */

export function newHostDoc(uid: string, displayName: string, deviceLabel: string, now: number): HostDoc {
  return {
    id: uid,
    schemaVersion: SCHEMA_VERSION,
    displayName,
    anonUid: uid,
    deviceLabel,
    locale: 'id',
    currency: 'IDR',
    roundingTo: 500,
    payment: { bankName: null, accountNumber: null, accountHolder: null, qrisImageUrl: null, note: null },
    sportDefaults: {},
    defaultSportId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export const hostRepo = {
  /** Creates the host document for this anonymous uid (idempotent: keeps an existing one). */
  async ensureHost(uid: string, displayName: string, deviceLabel: string): Promise<HostDoc> {
    const ref = paths.host(uid);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) return decode<HostDoc>(snap.data());
    } catch {
      // Offline with no cached copy: fall through and create locally; the write syncs later.
    }
    const host = newHostDoc(uid, displayName, deviceLabel, Date.now());
    track('host.create', setDoc(ref, encode(host)));
    return host;
  },

  async get(hostId: Id): Promise<HostDoc | null> {
    const snap = await getDoc(paths.host(hostId));
    return snap.exists() ? decode<HostDoc>(snap.data()) : null;
  },

  update(hostId: Id, patch: Partial<HostDoc>): void {
    track('host.update', setDoc(paths.host(hostId), encode({ ...patch, updatedAt: Date.now() }), { merge: true }));
  },

  observe(hostId: Id): Observable<HostDoc | null> {
    return observable((next, error) =>
      onSnapshot(
        paths.host(hostId),
        (snap) => next(snap.exists() ? decode<HostDoc>(snap.data()) : null),
        error,
      ),
    );
  },
};

/* ---------------------------------------------------------------------------- roster */

export function newRosterPlayer(hostId: Id, input: NewPlayerInput, now: number): RosterPlayerDoc {
  const name = input.name.trim();
  return {
    id: createId(),
    schemaVersion: SCHEMA_VERSION,
    hostId,
    name,
    nickname: input.nickname?.trim() || null,
    avatarUrl: input.avatarUrl ?? null,
    avatarColor: avatarColorFor(name),
    phone: input.phone?.trim() || null,
    notes: null,
    isGuest: input.isGuest ?? false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    summary: {},
  };
}

const BATCH_LIMIT = 400;

export const rosterRepo = {
  async list(hostId: Id, opts?: { includeArchived?: boolean }): Promise<RosterPlayerDoc[]> {
    const snap = await getDocs(query(paths.roster(hostId)));
    const all = snap.docs.map((d) => decode<RosterPlayerDoc>(d.data()));
    return opts?.includeArchived ? all : all.filter((p) => p.archivedAt === null);
  },

  observe(hostId: Id): Observable<RosterPlayerDoc[]> {
    return observable((next, error) =>
      onSnapshot(
        query(paths.roster(hostId)),
        (snap) => next(snap.docs.map((d) => decode<RosterPlayerDoc>(d.data()))),
        error,
      ),
    );
  },

  create(hostId: Id, input: NewPlayerInput): RosterPlayerDoc {
    const player = newRosterPlayer(hostId, input, Date.now());
    track('roster.create', setDoc(paths.player(hostId, player.id), encode(player)));
    return player;
  },

  /** Bulk paste: one batch per 400 names, minted locally. */
  createMany(hostId: Id, inputs: NewPlayerInput[]): RosterPlayerDoc[] {
    const now = Date.now();
    const players = inputs.map((i) => newRosterPlayer(hostId, i, now));
    for (let i = 0; i < players.length; i += BATCH_LIMIT) {
      const batch = writeBatch(getDb());
      for (const p of players.slice(i, i + BATCH_LIMIT)) batch.set(paths.player(hostId, p.id), encode(p));
      track('roster.createMany', batch.commit());
    }
    return players;
  },

  update(hostId: Id, playerId: Id, patch: Partial<RosterPlayerDoc>): void {
    const data: DocumentData = encode({ ...patch, updatedAt: Date.now() });
    track('roster.update', updateDoc(paths.player(hostId, playerId), data));
  },

  archive(hostId: Id, playerId: Id): void {
    const now = Date.now();
    track('roster.archive', updateDoc(paths.player(hostId, playerId), encode({ archivedAt: now, updatedAt: now })));
  },

  restore(hostId: Id, playerId: Id): void {
    track('roster.restore', updateDoc(paths.player(hostId, playerId), encode({ archivedAt: null, updatedAt: Date.now() })));
  },

  /** Explicit host action only (Settings -> Data). Removes the player and their stats subtree. */
  async hardDelete(hostId: Id, playerId: Id): Promise<void> {
    const subs = [
      paths.sessionResults(hostId, playerId),
      paths.rpEvents(hostId, playerId),
    ];
    const batch = writeBatch(getDb());
    for (const col of subs) {
      const snap = await getDocs(col);
      for (const d of snap.docs) batch.delete(d.ref);
    }
    for (const sport of ['padel', 'badminton', 'pingpong', 'billiard', 'mahjong']) {
      batch.delete(paths.sportStats(hostId, playerId, sport));
    }
    batch.delete(paths.player(hostId, playerId));
    track('roster.hardDelete', batch.commit());
  },
};
