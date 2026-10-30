import { useMemo } from 'react';

import { computeStandings } from '@/core/standings/computeStandings';
import { getSportPlugin } from '@/core/sports/registry';
import type { StandingRow } from '@/core/matchmaking/types';
import type { Id } from '@/types/common';
import type { Match, RoundDoc } from '@/types/round';
import type { SessionParticipant } from '@/types/session';
import { selectCurrentRound, useSessionStore } from '@/state/sessionStore';

/** The current round only; changes when a round is generated or one of its matches is edited. */
export function useCurrentRound(): RoundDoc | undefined {
  return useSessionStore(selectCurrentRound);
}

/**
 * One court's match in the current round. The returned object keeps its identity when other courts
 * change (immutable updates only replace the edited match), so a court card re-renders ONLY when its
 * own match changes. This is the render-count contract from docs/implementation_fe.md §4.2.
 */
export function useCourtMatch(courtId: Id): { roundId: Id; match: Match } | null {
  // Select primitives / the match object only — never the whole round — or every card would re-render.
  const roundId = useSessionStore((s) => selectCurrentRound(s)?.id);
  const match = useSessionStore((s) => selectCurrentRound(s)?.matches.find((m) => m.courtId === courtId));
  return useMemo(() => (roundId && match ? { roundId, match } : null), [roundId, match]);
}

/**
 * Standings for the live session, memoised on a cheap signature (round ids + revisions) rather than
 * array identity, so it only recomputes when a score actually changed.
 */
export function useStandings(): StandingRow[] {
  const session = useSessionStore((s) => s.session);
  const rounds = useSessionStore((s) => s.rounds);
  const signature = rounds.map((r) => `${r.id}:${r.revision}`).join('|');
  return useMemo(() => {
    if (!session) return [];
    return computeStandings(session.participants, rounds, getSportPlugin(session.sportId), session.scoreInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` stands in for `rounds`
  }, [session?.participants, session?.sportId, session?.scoreInput, signature]);
}

export function useParticipantMap(): Map<Id, SessionParticipant> {
  const participants = useSessionStore((s) => s.session?.participants);
  return useMemo(() => new Map((participants ?? []).map((p) => [p.playerId, p])), [participants]);
}
