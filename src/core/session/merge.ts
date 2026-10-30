/**
 * Co-host conflict resolution (docs/implementation_be.md §5.3).
 * Field-level merge of two versions of the same round:
 *   - teams / resting list: the host's version always wins (co-hosts only enter scores),
 *   - score + status: the most recently edited match wins, per match,
 *   - revision: max + 1 so the merged result is strictly newer than both inputs.
 * Pure, so it is unit-testable without a second device.
 */

import type { Match, RoundDoc } from '@/types/round';
import { allMatchesSettled } from './sessionEngine';

export type Role = 'host' | 'cohost';

function pickScoreSide(local: Match, remote: Match): Match {
  const lt = local.updatedAt ?? 0;
  const rt = remote.updatedAt ?? 0;
  if (lt !== rt) return lt > rt ? local : remote;
  // Same instant: a settled match beats an unsettled one; otherwise keep the local copy.
  const settled = (m: Match) => m.status === 'completed' || m.status === 'voided';
  if (settled(remote) && !settled(local)) return remote;
  return local;
}

export function mergeRounds(local: RoundDoc, remote: RoundDoc, role: Role, uid: string, now: number): RoundDoc {
  const authority = role === 'host' ? local : remote;
  const localById = new Map(local.matches.map((m) => [m.id, m]));
  const remoteById = new Map(remote.matches.map((m) => [m.id, m]));

  const matches: Match[] = authority.matches.map((base) => {
    const l = localById.get(base.id);
    const r = remoteById.get(base.id);
    if (!l || !r) return base;
    const winner = pickScoreSide(l, r);
    return {
      ...base,
      status: winner.status,
      score: winner.score,
      startedAt: winner.startedAt,
      completedAt: winner.completedAt,
      updatedAt: winner.updatedAt,
    };
  });

  const merged: RoundDoc = {
    ...authority,
    matches,
    revision: Math.max(local.revision, remote.revision) + 1,
    lastWriterUid: uid,
    updatedAt: now,
  };
  return allMatchesSettled(merged)
    ? { ...merged, status: 'completed', completedAt: merged.completedAt ?? now }
    : { ...merged, status: merged.status === 'completed' ? 'in_progress' : merged.status, completedAt: null };
}

/** Matches whose score differs between two versions, for the "diperbarui oleh …" toast. */
export function changedMatchIds(before: RoundDoc, after: RoundDoc): string[] {
  const prev = new Map(before.matches.map((m) => [m.id, m]));
  return after.matches
    .filter((m) => {
      const p = prev.get(m.id);
      return !p || p.status !== m.status || p.score.points.join() !== m.score.points.join();
    })
    .map((m) => m.id);
}
