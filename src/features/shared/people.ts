import { create } from 'zustand';
import { initialsOf, avatarColorFor } from '@/core/utils/avatar';
import type { RosterPlayerDoc } from '@/types/player';
import type { SessionParticipant } from '@/types/session';

/** Short device label shown to the host when a co-host joins ("HP Android", "iPhone"). */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'HP Android';
  return 'Browser';
}

export function displayName(p: { name: string; nickname: string | null }): string {
  return p.nickname?.trim() || p.name;
}

export { initialsOf, avatarColorFor };

export function participantFromPlayer(player: RosterPlayerDoc): SessionParticipant {
  return {
    playerId: player.id,
    name: player.name,
    nickname: player.nickname,
    avatarUrl: player.avatarUrl ?? null,
    avatarColor: player.avatarColor,
    isGuest: player.isGuest,
    joinedAtRound: 1,
    leftAtRound: null,
    includeInRanking: !player.isGuest,
    includeInBill: true,
  };
}

/** Name lookup for a session's participants, by id. */
export function nameMap(participants: SessionParticipant[]): Map<string, SessionParticipant> {
  return new Map(participants.map((p) => [p.playerId, p]));
}

/** Join a team's players into one label: "Rizky & Budi" (joiner is localised by the caller). */
export function teamLabel(ids: string[], byId: Map<string, SessionParticipant>, joiner: string): string {
  return ids
    .map((id) => {
      const p = byId.get(id);
      return p ? displayName(p) : '?';
    })
    .join(joiner);
}

/** Setup selection that survives navigating between the three setup steps. */
interface SetupDraft {
  sportId: string | null;
  playerIds: string[];
  guests: RosterPlayerDoc[];
  courtCount: number | null;
  courtLabels: string[];
  targetRounds: number | null;
  format: string;
  config: Record<string, number | boolean | string>;
  title: string;
  venue: string;
  patch: (p: Partial<Omit<SetupDraft, 'patch' | 'reset'>>) => void;
  reset: () => void;
}

const emptyDraft = {
  sportId: null,
  playerIds: [] as string[],
  guests: [] as RosterPlayerDoc[],
  courtCount: null,
  courtLabels: [] as string[],
  targetRounds: null,
  format: 'americano',
  config: {} as Record<string, number | boolean | string>,
  title: '',
  venue: '',
};

export const useSetupDraft = create<SetupDraft>()((set) => ({
  ...emptyDraft,
  patch: (p) => set(p),
  reset: () => set({ ...emptyDraft }),
}));
