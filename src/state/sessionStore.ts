/**
 * Live-session store: the SOURCE OF TRUTH while a session runs (Zustand + localStorage, synchronous).
 * Firestore is the replica. Every mutating action: mutate -> persist (sync) -> mark dirty. The
 * background flusher (sync.ts) watches the dirty flags; nothing here awaits the network.
 * See docs/implementation_be.md §5.2 and api_contract.md §7.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Id } from '@/types/common';
import type { BillDoc, BillItem } from '@/types/bill';
import type { Match, RoundDoc } from '@/types/round';
import type { NewSessionInput, SessionDoc, SessionParticipant } from '@/types/session';
import type { SportPlugin } from '@/types/sport';
import { CourtNotClaimedError, InsufficientPlayersError, SessionAlreadyCommittedError } from '@/core/matchmaking/errors';
import { getSportPlugin } from '@/core/sports/registry';
import { billIssues, newBill, recomputeBill, upsertItem, type BillIssue } from '@/core/session/bill';
import { buildFinish, unsettledMatchCount, type FinishResult } from '@/core/session/finish';
import {
  LIMITS,
  addParticipant as addParticipantPure,
  allMatchesSettled,
  buildNextRound,
  completeMatch as completeMatchPure,
  removeParticipant as removeParticipantPure,
  reopenMatch as reopenMatchPure,
  resetMatchScore,
  canDeactivateCourt,
  setCourtActive as setCourtActivePure,
  setMatchScore,
  substituteInRound,
  swapInRound,
  voidMatch as voidMatchPure,
  voidUnsettled,
  completionBlocker,
  type ScoreChange,
} from '@/core/session/sessionEngine';
import { mergeRounds, type Role } from '@/core/session/merge';
import { newSessionDoc } from '@/data/sessionRepo';
import { statsRepo } from '@/data/statsRepo';
import { useBootStore } from './bootStore';
import { jsonStorage } from './storage';

export type StartResult = { ok: true; sessionId: Id } | { ok: false; error: 'insufficient_players' | 'limit' };
export type CourtToggleResult =
  | { ok: true; appliedNow: boolean }
  | { ok: false; error: 'last_court' | 'readonly' | 'no_session' };

export type NextRoundResult =
  | { ok: true; roundNumber: number }
  | { ok: false; error: 'unsettled' | 'insufficient_players' | 'limit' | 'no_session' | 'readonly' };

/** One reversible edit; ephemeral (not persisted). */
export interface UndoEntry {
  roundId: Id;
  matchId: Id;
  prev: Pick<Match, 'score' | 'status' | 'startedAt' | 'completedAt' | 'updatedAt'>;
  label: 'score' | 'complete' | 'reopen' | 'void' | 'reset';
}

interface SessionState {
  session: SessionDoc | null;
  rounds: RoundDoc[];
  bill: BillDoc | null;
  billIssues: BillIssue[];
  finish: FinishResult | null;

  role: Role;
  claimedCourtIds: Id[];
  /** Last revision seen from the server per round; compare-and-set base for co-host writes. */
  baseRevision: Record<Id, number>;

  /* Dirty flags drive the flusher; persisted so a reload before the debounce still flushes. */
  dirtyRounds: Id[];
  sessionDirty: boolean;
  billDirty: boolean;

  undo: UndoEntry[];
  /** Unsent toast-worthy merge notices ("Skor lapangan 2 diperbarui oleh HP Rizky"). */
  notices: Array<{ id: string; courtLabel: string; by: string }>;

  /* lifecycle */
  startSession: (input: NewSessionInput) => StartResult;
  joinAsCoHost: (session: SessionDoc, rounds: RoundDoc[], claimedCourtIds: Id[]) => void;
  leave: () => void;
  discard: () => void;

  /* rounds */
  generateNextRound: () => NextRoundResult;
  reshuffleCurrentRound: () => NextRoundResult;

  /* scoring */
  setScore: (roundId: Id, matchId: Id, change: ScoreChange) => void;
  completeMatch: (roundId: Id, matchId: Id) => void;
  reopenMatch: (roundId: Id, matchId: Id) => void;
  voidMatch: (roundId: Id, matchId: Id) => void;
  resetMatch: (roundId: Id, matchId: Id) => void;
  undoLast: () => UndoEntry | null;
  voidAllUnsettled: () => void;

  /* overrides */
  swapPlayers: (roundId: Id, a: Id, b: Id) => void;
  substitute: (outId: Id, inId: Id) => void;
  addParticipant: (participant: SessionParticipant) => void;
  removeParticipant: (playerId: Id) => void;
  /** Takes effect immediately if the current round is untouched, otherwise from the next round. */
  setCourtActive: (courtId: Id, active: boolean) => CourtToggleResult;
  claimCourts: (courtIds: Id[]) => void;

  /* bill */
  ensureBill: (args: { hostId: Id; roundingTo: number; hostPlayerId: Id | null }) => void;
  upsertBillItem: (item: BillItem) => void;
  removeBillItem: (itemId: Id) => void;
  setBillMeta: (patch: Partial<Pick<BillDoc, 'roundingTo' | 'hostPlayerId' | 'note'>>) => void;

  /* finish */
  finishSession: (hostId: Id) => Promise<FinishResult>;
  reopenFinished: (hostId: Id) => Promise<void>;
  abandonSession: () => void;
  setTitleVenue: (patch: { title?: string | null; venue?: string | null }) => void;

  /* co-host */
  setJoinCode: (code: string | null, expiresAt: number | null) => void;
  setCoHostCount: (count: number) => void;

  /* replication callbacks (called by sync.ts) */
  applyRemoteRounds: (remote: RoundDoc[]) => void;
  applyRemoteSession: (remote: SessionDoc) => void;
  markFlushed: (flushed: { roundIds: Id[]; session: boolean; bill: boolean }) => void;
  markRoundBase: (roundId: Id, revision: number) => void;
  dismissNotice: (id: string) => void;
}

const UNDO_CAP = 50;
const randomSeed = (): number => {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] ?? 1;
};

const uidNow = (): string => useBootStore.getState().uid ?? 'local';

function pluginOf(session: SessionDoc): SportPlugin {
  return getSportPlugin(session.sportId);
}

function sortRounds(rounds: RoundDoc[]): RoundDoc[] {
  return [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
}

function replaceRound(rounds: RoundDoc[], next: RoundDoc): RoundDoc[] {
  return rounds.map((r) => (r.id === next.id ? next : r));
}

function snapshotMatch(m: Match): UndoEntry['prev'] {
  return { score: m.score, status: m.status, startedAt: m.startedAt, completedAt: m.completedAt, updatedAt: m.updatedAt };
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => {
      /** Applies a pure round transformation, records undo, marks the round dirty. */
      const editMatch = (
        roundId: Id,
        matchId: Id,
        label: UndoEntry['label'],
        transform: (round: RoundDoc, plugin: SportPlugin, session: SessionDoc) => RoundDoc,
      ): void => {
        const { session, rounds, role, claimedCourtIds } = get();
        if (!session) return;
        const round = rounds.find((r) => r.id === roundId);
        const match = round?.matches.find((m) => m.id === matchId);
        if (!round || !match) return;
        if (role === 'cohost' && !claimedCourtIds.includes(match.courtId)) throw new CourtNotClaimedError(match.courtId);

        const next = transform(round, pluginOf(session), session);
        if (next === round) return;
        const undoEntry: UndoEntry = { roundId, matchId, prev: snapshotMatch(match), label };
        set((s) => ({
          rounds: replaceRound(s.rounds, next),
          undo: [...s.undo, undoEntry].slice(-UNDO_CAP),
          dirtyRounds: s.dirtyRounds.includes(roundId) ? s.dirtyRounds : [...s.dirtyRounds, roundId],
        }));
      };

      const markRoundDirty = (roundId: Id) =>
        set((s) => ({ dirtyRounds: s.dirtyRounds.includes(roundId) ? s.dirtyRounds : [...s.dirtyRounds, roundId] }));

      return {
        session: null,
        rounds: [],
        bill: null,
        billIssues: [],
        finish: null,
        role: 'host',
        claimedCourtIds: [],
        baseRevision: {},
        dirtyRounds: [],
        sessionDirty: false,
        billDirty: false,
        undo: [],
        notices: [],

        /* ---------------------------------------------------------------- lifecycle */

        startSession: (input) => {
          if (input.participants.length > LIMITS.participants || input.courts.length > LIMITS.courts) {
            return { ok: false, error: 'limit' };
          }
          const now = Date.now();
          const session = newSessionDoc(input, now);
          const plugin = pluginOf(session);
          let round: RoundDoc;
          try {
            round = buildNextRound({ session, rounds: [], plugin, seed: randomSeed(), uid: uidNow(), now });
          } catch (error) {
            if (error instanceof InsufficientPlayersError) return { ok: false, error: 'insufficient_players' };
            throw error;
          }
          set({
            session,
            rounds: [round],
            bill: null,
            billIssues: [],
            finish: null,
            role: 'host',
            claimedCourtIds: [],
            baseRevision: {},
            dirtyRounds: [round.id],
            sessionDirty: true,
            billDirty: false,
            undo: [],
            notices: [],
          });
          return { ok: true, sessionId: session.id };
        },

        joinAsCoHost: (session, rounds, claimedCourtIds) =>
          set({
            session,
            rounds: sortRounds(rounds),
            bill: null,
            billIssues: [],
            finish: null,
            role: 'cohost',
            claimedCourtIds,
            baseRevision: Object.fromEntries(rounds.map((r) => [r.id, r.revision])),
            dirtyRounds: [],
            sessionDirty: false,
            billDirty: false,
            undo: [],
            notices: [],
          }),

        leave: () =>
          set({ session: null, rounds: [], bill: null, billIssues: [], finish: null, role: 'host', claimedCourtIds: [], baseRevision: {}, dirtyRounds: [], sessionDirty: false, billDirty: false, undo: [], notices: [] }),

        discard: () => get().leave(),

        /* -------------------------------------------------------------------- rounds */

        generateNextRound: () => {
          const { session, rounds, role } = get();
          if (!session) return { ok: false, error: 'no_session' };
          if (role === 'cohost') return { ok: false, error: 'readonly' };
          if (rounds.length >= LIMITS.rounds) return { ok: false, error: 'limit' };
          const current = sortRounds(rounds).at(-1);
          if (current && !allMatchesSettled(current)) return { ok: false, error: 'unsettled' };
          const now = Date.now();
          try {
            const round = buildNextRound({ session, rounds, plugin: pluginOf(session), seed: randomSeed(), uid: uidNow(), now });
            set((s) => ({
              rounds: [...s.rounds, round],
              session: s.session && {
                ...s.session,
                currentRoundNumber: round.roundNumber,
                completedRoundCount: s.rounds.filter((r) => r.status === 'completed').length,
                updatedAt: now,
              },
              dirtyRounds: [...s.dirtyRounds, round.id],
              sessionDirty: true,
            }));
            return { ok: true, roundNumber: round.roundNumber };
          } catch (error) {
            if (error instanceof InsufficientPlayersError) return { ok: false, error: 'insufficient_players' };
            throw error;
          }
        },

        /** "Acak ulang": only while nothing on the current round has been scored. */
        reshuffleCurrentRound: () => {
          const { session, rounds, role } = get();
          if (!session) return { ok: false, error: 'no_session' };
          if (role === 'cohost') return { ok: false, error: 'readonly' };
          const current = sortRounds(rounds).at(-1);
          if (!current || current.matches.some((m) => m.status !== 'scheduled')) return { ok: false, error: 'unsettled' };
          const now = Date.now();
          const others = rounds.filter((r) => r.id !== current.id);
          try {
            const fresh = buildNextRound({ session, rounds: others, plugin: pluginOf(session), seed: randomSeed(), uid: uidNow(), now });
            const replaced: RoundDoc = { ...fresh, id: current.id, createdAt: current.createdAt, revision: current.revision + 1 };
            set((s) => ({ rounds: replaceRound(s.rounds, replaced) }));
            markRoundDirty(replaced.id);
            return { ok: true, roundNumber: replaced.roundNumber };
          } catch (error) {
            if (error instanceof InsufficientPlayersError) return { ok: false, error: 'insufficient_players' };
            throw error;
          }
        },

        /* ------------------------------------------------------------------- scoring */

        setScore: (roundId, matchId, change) =>
          editMatch(roundId, matchId, 'score', (round, plugin, session) =>
            setMatchScore(round, matchId, change, plugin, session.scoreInput, uidNow(), Date.now()),
          ),

        completeMatch: (roundId, matchId) =>
          editMatch(roundId, matchId, 'complete', (round, plugin, session) =>
            completeMatchPure(round, matchId, plugin, session.scoreInput, uidNow(), Date.now()),
          ),

        reopenMatch: (roundId, matchId) =>
          editMatch(roundId, matchId, 'reopen', (round) => reopenMatchPure(round, matchId, uidNow(), Date.now())),

        voidMatch: (roundId, matchId) =>
          editMatch(roundId, matchId, 'void', (round) => voidMatchPure(round, matchId, uidNow(), Date.now())),

        resetMatch: (roundId, matchId) =>
          editMatch(roundId, matchId, 'reset', (round, plugin, session) =>
            resetMatchScore(round, matchId, plugin, session.scoreInput, uidNow(), Date.now()),
          ),

        undoLast: () => {
          const { undo, rounds } = get();
          const entry = undo.at(-1);
          if (!entry) return null;
          const round = rounds.find((r) => r.id === entry.roundId);
          if (!round) return null;
          const now = Date.now();
          const matches = round.matches.map((m) => (m.id === entry.matchId ? { ...m, ...entry.prev, updatedAt: now } : m));
          const settled = matches.length > 0 && matches.every((m) => m.status === 'completed' || m.status === 'voided');
          const restored: RoundDoc = {
            ...round,
            matches,
            status: settled ? 'completed' : round.status === 'completed' ? 'in_progress' : round.status,
            completedAt: settled ? (round.completedAt ?? now) : null,
            updatedAt: now,
            lastWriterUid: uidNow(),
            revision: round.revision + 1,
          };
          set((s) => ({ rounds: replaceRound(s.rounds, restored), undo: s.undo.slice(0, -1) }));
          markRoundDirty(round.id);
          return entry;
        },

        voidAllUnsettled: () => {
          const { rounds } = get();
          const now = Date.now();
          const dirty: Id[] = [];
          const next = rounds.map((r) => {
            if (r.matches.every((m) => m.status === 'completed' || m.status === 'voided')) return r;
            dirty.push(r.id);
            return voidUnsettled(r, uidNow(), now);
          });
          set((s) => ({ rounds: next, dirtyRounds: [...new Set([...s.dirtyRounds, ...dirty])] }));
        },

        /* ----------------------------------------------------------------- overrides */

        swapPlayers: (roundId, a, b) => {
          const round = get().rounds.find((r) => r.id === roundId);
          if (!round || get().role === 'cohost') return;
          set((s) => ({ rounds: replaceRound(s.rounds, swapInRound(round, a, b, uidNow(), Date.now())) }));
          markRoundDirty(roundId);
        },

        substitute: (outId, inId) => {
          const { session, rounds, role } = get();
          if (!session || role === 'cohost') return;
          const current = sortRounds(rounds).at(-1);
          if (!current) return;
          const now = Date.now();
          const fromRound = current.roundNumber + 1;
          const nextRound = substituteInRound(current, outId, inId, uidNow(), now);
          const outP = session.participants.find((p) => p.playerId === outId);
          const inP = session.participants.find((p) => p.playerId === inId);
          let nextSession = session;
          if (outP) nextSession = removeParticipantPure(nextSession, outId, fromRound, now);
          if (inP) nextSession = addParticipantPure(nextSession, { ...inP, leftAtRound: null }, current.roundNumber, now);
          set((s) => ({ rounds: replaceRound(s.rounds, nextRound), session: nextSession, sessionDirty: true }));
          markRoundDirty(current.id);
        },

        addParticipant: (participant) => {
          const { session, rounds, role } = get();
          if (!session || role === 'cohost') return;
          const from = (sortRounds(rounds).at(-1)?.roundNumber ?? 0) + 1;
          set({ session: addParticipantPure(session, participant, from, Date.now()), sessionDirty: true });
        },

        removeParticipant: (playerId) => {
          const { session, rounds, role } = get();
          if (!session || role === 'cohost') return;
          const from = (sortRounds(rounds).at(-1)?.roundNumber ?? 0) + 1;
          set({ session: removeParticipantPure(session, playerId, from, Date.now()), sessionDirty: true });
        },

        setCourtActive: (courtId, active) => {
          const { session, rounds, role } = get();
          if (!session) return { ok: false, error: 'no_session' };
          if (role === 'cohost') return { ok: false, error: 'readonly' };
          if (!active && !canDeactivateCourt(session, courtId)) return { ok: false, error: 'last_court' };
          const now = Date.now();
          const nextSession = setCourtActivePure(session, courtId, active, now);
          set({ session: nextSession, sessionDirty: true });

          // Nothing scored yet on the current round: rebuild it now so the change is visible at once
          // (a court switched off disappears, a court switched on gets a match).
          const current = sortRounds(rounds).at(-1);
          if (!current || !current.matches.every((m) => m.status === 'scheduled')) return { ok: true, appliedNow: false };
          try {
            const others = rounds.filter((r) => r.id !== current.id);
            const fresh = buildNextRound({ session: nextSession, rounds: others, plugin: pluginOf(nextSession), seed: randomSeed(), uid: uidNow(), now });
            const replaced: RoundDoc = { ...fresh, id: current.id, createdAt: current.createdAt, revision: current.revision + 1 };
            set((s) => ({ rounds: replaceRound(s.rounds, replaced) }));
            markRoundDirty(replaced.id);
            return { ok: true, appliedNow: true };
          } catch (error) {
            if (error instanceof InsufficientPlayersError) return { ok: true, appliedNow: false };
            throw error;
          }
        },

        claimCourts: (courtIds) => set({ claimedCourtIds: courtIds }),

        /* ---------------------------------------------------------------------- bill */

        ensureBill: ({ hostId, roundingTo, hostPlayerId }) => {
          const { session, bill } = get();
          if (!session || bill) return;
          set({ bill: newBill({ sessionId: session.id, hostId, roundingTo, hostPlayerId, now: Date.now() }), billDirty: true });
        },

        upsertBillItem: (item) => {
          const { session, bill } = get();
          if (!session || !bill) return;
          const items = upsertItem(bill.items, item);
          const next = recomputeBill({ ...bill, items }, session.participants, Date.now());
          set({ bill: next, billIssues: billIssues(items, session.participants), billDirty: true });
        },

        removeBillItem: (itemId) => {
          const { session, bill } = get();
          if (!session || !bill) return;
          const items = bill.items.filter((i) => i.id !== itemId);
          const next = recomputeBill({ ...bill, items }, session.participants, Date.now());
          set({ bill: next, billIssues: billIssues(items, session.participants), billDirty: true });
        },

        setBillMeta: (patch) => {
          const { session, bill } = get();
          if (!session || !bill) return;
          const next = recomputeBill({ ...bill, ...patch }, session.participants, Date.now());
          set({ bill: next, billDirty: true });
        },

        /* -------------------------------------------------------------------- finish */

        finishSession: async (hostId) => {
          const { session, rounds } = get();
          if (!session) throw new Error('no active session');
          if (unsettledMatchCount(rounds) > 0) throw new Error('unsettled matches');
          const plugin = pluginOf(session);
          const now = Date.now();

          const prior: Record<Id, Awaited<ReturnType<typeof statsRepo.getSportStats>>> = {};
          await Promise.all(
            session.participants
              .filter((p) => p.includeInRanking)
              .map(async (p) => {
                prior[p.playerId] = await statsRepo.getSportStats(hostId, p.playerId, session.sportId).catch(() => null);
              }),
          );

          const result = buildFinish({ session, rounds, plugin, prior, now });
          const finished: SessionDoc = {
            ...session,
            status: 'finished',
            rankingApplied: true,
            finishedAt: now,
            completedRoundCount: rounds.filter((r) => r.status === 'completed').length,
            updatedAt: now,
          };
          // Commit BEFORE flipping the local flag: the repo's idempotency guard reads the session doc, and our own
          // debounced replication of rankingApplied=true must not be mistaken for an earlier commit.
          // The batch itself is fire-and-forget (lands in the local cache immediately, syncs later).
          await statsRepo.commitSessionResults(hostId, session.id, result.payload).catch((error: unknown) => {
            if (!(error instanceof SessionAlreadyCommittedError)) throw error;
          });
          set({ session: finished, finish: result, sessionDirty: true });
          return result;
        },

        /** Editing a finished session: roll the ladder back so the corrected result can be committed again. */
        reopenFinished: async (hostId) => {
          const { session } = get();
          if (!session) return;
          const ids = session.participants.filter((p) => p.includeInRanking).map((p) => p.playerId);
          if (session.rankingApplied) await statsRepo.revertSessionResults(hostId, session.id, ids, session.sportId);
          set({
            session: { ...session, status: 'live', rankingApplied: false, finishedAt: null, updatedAt: Date.now() },
            finish: null,
            sessionDirty: true,
          });
        },

        abandonSession: () => {
          const { session } = get();
          if (!session) return;
          const now = Date.now();
          set({ session: { ...session, status: 'abandoned', updatedAt: now, finishedAt: now }, sessionDirty: true });
        },

        setTitleVenue: (patch) => {
          const { session } = get();
          if (!session) return;
          set({ session: { ...session, ...patch, updatedAt: Date.now() }, sessionDirty: true });
        },

        setJoinCode: (code, expiresAt) => {
          const { session } = get();
          if (!session) return;
          set({ session: { ...session, joinCode: code, joinCodeExpiresAt: expiresAt, updatedAt: Date.now() }, sessionDirty: true });
        },

        setCoHostCount: (count) => {
          const { session } = get();
          if (!session || session.coHostCount === count) return;
          set({ session: { ...session, coHostCount: count, updatedAt: Date.now() }, sessionDirty: true });
        },

        /* --------------------------------------------------------------- replication */

        applyRemoteRounds: (remote) => {
          const { rounds, role, baseRevision, session } = get();
          if (!session) return;
          let next = rounds;
          const dirty: Id[] = [];
          const notices: SessionState['notices'] = [];
          const bases = { ...baseRevision };
          for (const r of remote) {
            bases[r.id] = Math.max(bases[r.id] ?? 0, r.revision);
            const local = next.find((x) => x.id === r.id);
            if (!local) {
              if (role === 'cohost' || !rounds.length) next = sortRounds([...next, r]);
              continue;
            }
            if (r.revision <= local.revision) continue; // ours is newer or equal
            const merged = mergeRounds(local, r, role, uidNow(), Date.now());
            next = replaceRound(next, merged);
            dirty.push(merged.id);
            for (const m of merged.matches) {
              const before = local.matches.find((x) => x.id === m.id);
              if (before && before.score.points.join() !== m.score.points.join()) {
                const court = session.courts.find((c) => c.id === m.courtId);
                notices.push({ id: `${merged.id}:${m.id}:${merged.revision}`, courtLabel: court?.label ?? '', by: r.lastWriterUid });
              }
            }
          }
          set((s) => ({
            rounds: next,
            baseRevision: bases,
            dirtyRounds: [...new Set([...s.dirtyRounds, ...dirty])],
            notices: [...s.notices, ...notices].slice(-5),
          }));
        },

        applyRemoteSession: (remote) => {
          const { session, role } = get();
          if (!session || remote.id !== session.id) return;
          if (role === 'cohost') set({ session: remote });
        },

        markFlushed: ({ roundIds, session, bill }) =>
          set((s) => ({
            dirtyRounds: s.dirtyRounds.filter((id) => !roundIds.includes(id)),
            sessionDirty: session ? false : s.sessionDirty,
            billDirty: bill ? false : s.billDirty,
          })),

        markRoundBase: (roundId, revision) => set((s) => ({ baseRevision: { ...s.baseRevision, [roundId]: revision } })),

        dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
      };
    },
    {
      name: 'frdup.session',
      version: 1,
      storage: jsonStorage,
      partialize: (s) => ({
        session: s.session,
        rounds: s.rounds,
        bill: s.bill,
        billIssues: s.billIssues,
        finish: s.finish,
        role: s.role,
        claimedCourtIds: s.claimedCourtIds,
        baseRevision: s.baseRevision,
        dirtyRounds: s.dirtyRounds,
        sessionDirty: s.sessionDirty,
        billDirty: s.billDirty,
      }),
    },
  ),
);

/* -------------------------------------------------------------------------- selectors */

export const selectCurrentRound = (s: SessionState): RoundDoc | undefined => {
  let best: RoundDoc | undefined;
  for (const r of s.rounds) if (!best || r.roundNumber > best.roundNumber) best = r;
  return best;
};

export const selectPlugin = (s: SessionState): SportPlugin | null => (s.session ? getSportPlugin(s.session.sportId) : null);

export function selectCompletionBlocker(s: SessionState, roundId: Id, matchId: Id): string | null {
  const match = s.rounds.find((r) => r.id === roundId)?.matches.find((m) => m.id === matchId);
  if (!match || !s.session) return 'session.court.blocker.noScore';
  return completionBlocker(match, getSportPlugin(s.session.sportId), s.session.scoreInput);
}

