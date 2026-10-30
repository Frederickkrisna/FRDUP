import { describe, expect, it } from 'vitest';
import { getSportPlugin } from '@/core/sports/registry';
import { buildFinish } from '@/core/session/finish';
import { buildNextRound, completeMatch, setMatchScore } from '@/core/session/sessionEngine';
import { newBill, recomputeBill } from '@/core/session/bill';
import { makeSession } from '@/core/session/__tests__/helpers';
import type { RoundDoc } from '@/types/round';
import type { HostDoc } from '@/types/host';
import type { RosterPlayerDoc } from '@/types/player';
import { BackupFormatError, backupFilename, countBackup, remapBackup, validateBackup, type BackupFile } from '../backup';

const plugin = getSportPlugin('badminton');

function fixture(): BackupFile {
  const session = makeSession('badminton', 9, 2);
  const spec = session.scoreInput;
  const rounds: RoundDoc[] = [];
  for (let i = 0; i < 4; i++) {
    let r = buildNextRound({ session, rounds, plugin, seed: 20 + i, uid: 'old-uid', now: i });
    for (const m of r.matches) {
      r = setMatchScore(r, m.id, { teamIndex: 0, value: 21, mode: 'set' }, plugin, spec, 'old-uid', i);
      r = setMatchScore(r, m.id, { teamIndex: 1, value: 9, mode: 'set' }, plugin, spec, 'old-uid', i);
      r = completeMatch(r, m.id, plugin, spec, 'old-uid', i);
    }
    rounds.push(r);
  }
  const out = buildFinish({ session, rounds, plugin, prior: {}, now: 9 });
  const bill = recomputeBill({ ...newBill({ sessionId: session.id, hostId: 'old-uid', roundingTo: 500, hostPlayerId: null, now: 1 }), items: [] }, session.participants, 2);
  const host = { id: 'old-uid', anonUid: 'old-uid', displayName: 'Frederick' } as HostDoc;
  return {
    app: 'frdup',
    formatVersion: 1,
    exportedAt: 1,
    host,
    players: session.participants.map((p) => {
      const pp = out.payload.perPlayer.find((x) => x.playerId === p.playerId);
      return {
        doc: { id: p.playerId, hostId: 'old-uid', name: p.name } as RosterPlayerDoc,
        stats: pp ? [pp.statsPatch as never] : [],
        results: pp ? [pp.result] : [],
        events: pp ? [{ ...pp.rpEvent, id: `e-${p.playerId}`, schemaVersion: 1 }] : [],
      };
    }),
    sessions: [{ doc: { ...session, hostId: 'old-uid', hostAnonUid: 'old-uid', joinCode: 'ABC234', joinCodeExpiresAt: 99 }, rounds, bill }],
  };
}

describe('backup', () => {
  it('validates a good file and rejects bad ones with a reason', () => {
    expect(() => validateBackup(JSON.parse(JSON.stringify(fixture())))).not.toThrow();
    for (const bad of [null, 5, {}, { app: 'other' }, { ...fixture(), formatVersion: 99 }, { ...fixture(), players: 'x' }]) {
      expect(() => validateBackup(bad)).toThrow(BackupFormatError);
    }
    const noName = fixture();
    (noName.players[0]!.doc as { name?: string }).name = undefined;
    expect(() => validateBackup(noName)).toThrow(BackupFormatError);
  });

  it('survives JSON serialisation round trip with zero loss', () => {
    const f = fixture();
    const again = validateBackup(JSON.parse(JSON.stringify(f)));
    expect(countBackup(again)).toEqual(countBackup(f));
    expect(again).toEqual(f);
  });

  it('re-mints under a new uid and keeps every reference consistent', () => {
    const f = fixture();
    const before = countBackup(f);
    const r = remapBackup(f, 'new-uid', 5000);

    expect(countBackup(r)).toEqual(before); // nothing dropped
    expect(r.host.id).toBe('new-uid');
    expect(r.host.anonUid).toBe('new-uid');
    expect(r.players.every((p) => p.doc.hostId === 'new-uid')).toBe(true);

    const oldId = f.sessions[0]!.doc.id;
    const newId = r.sessions[0]!.doc.id;
    expect(newId).not.toBe(oldId);
    expect(r.sessions[0]!.doc.hostId).toBe('new-uid');
    expect(r.sessions[0]!.doc.joinCode).toBeNull(); // a restored session starts with its code closed
    expect(r.sessions[0]!.rounds.every((x) => x.sessionId === newId && x.lastWriterUid === 'new-uid')).toBe(true);
    expect(r.sessions[0]!.bill?.sessionId).toBe(newId);

    for (const p of r.players) {
      expect(p.results.every((x) => x.sessionId === newId && x.id === newId)).toBe(true);
      expect(p.events.every((e) => e.sessionId === newId)).toBe(true);
    }
    // Round contents (the actual scores) are untouched.
    expect(r.sessions[0]!.rounds.map((x) => x.matches.map((m) => m.score.points))).toEqual(
      f.sessions[0]!.rounds.map((x) => x.matches.map((m) => m.score.points)),
    );
    // The input is not mutated.
    expect(f.host.id).toBe('old-uid');
  });

  it('filename uses the local date', () => {
    expect(backupFilename(new Date(2026, 8, 12, 10).getTime())).toBe('frdup-backup-2026-09-12.json');
  });
});
