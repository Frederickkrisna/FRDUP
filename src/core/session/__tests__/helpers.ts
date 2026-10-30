import { getSportPlugin } from '@/core/sports/registry';
import type { SessionDoc, SessionParticipant } from '@/types/session';
import type { SportId } from '@/types/sport';

export function makeParticipants(n: number): SessionParticipant[] {
  return Array.from({ length: n }, (_, i) => ({
    playerId: `p${i + 1}`,
    name: `Player ${i + 1}`,
    nickname: null,
    avatarColor: '#000000',
    isGuest: false,
    joinedAtRound: 1,
    leftAtRound: null,
    includeInRanking: true,
    includeInBill: true,
  }));
}

export function makeSession(sportId: SportId, players: number, courts: number, format: SessionDoc['format'] = 'americano'): SessionDoc {
  const plugin = getSportPlugin(sportId);
  const scoreInput = plugin.buildScoreInput({});
  return {
    id: 's1',
    schemaVersion: 1,
    hostId: 'host',
    hostAnonUid: 'host',
    sportId,
    format,
    status: 'live',
    title: null,
    venue: null,
    playedAt: 1_700_000_000_000,
    sportConfig: {},
    scoreInput,
    courts: Array.from({ length: courts }, (_, i) => ({ id: `c${i + 1}`, index: i, label: `L${i + 1}`, isActive: true })),
    targetRounds: null,
    plannedEndAt: null,
    participants: makeParticipants(players),
    currentRoundNumber: 1,
    completedRoundCount: 0,
    joinCode: null,
    joinCodeExpiresAt: null,
    coHostCount: 0,
    rankingApplied: false,
    billId: null,
    createdAt: 0,
    updatedAt: 0,
    finishedAt: null,
  };
}
