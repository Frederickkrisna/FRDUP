/** Builds the export-card data objects from domain data. Pure given a `t` function. */

import type { TFunction } from 'i18next';

import type { StandingRow } from '@/core/matchmaking/types';
import type { AllTimeRow } from '@/core/leaderboard/allTime';
import type { RankChange } from '@/core/session/finish';
import { getSportPlugin } from '@/core/sports/registry';
import { initialsOf } from '@/core/utils/avatar';
import { formatDateWithDay, toIsoDate } from '@/core/utils/date';
import type { SessionDoc } from '@/types/session';
import type { SportId } from '@/types/sport';
import type { CardEntry, LeaderboardCardData, TierUpCardData } from './types';

const num = new Intl.NumberFormat('id-ID');

function captions(t: TFunction) {
  return {
    podium: t('board.captions.podium'),
    rpUnit: t('board.captions.rpUnit'),
    brand: t('common.appName'),
    madeWith: t('board.captions.madeWith'),
  };
}

/** Standings -> card data. The primary metric follows the plugin's first sort field. */
export function sessionCardData(args: {
  session: SessionDoc;
  standings: StandingRow[];
  changes: RankChange[];
  t: TFunction;
}): LeaderboardCardData {
  const { session, standings, changes, t } = args;
  const plugin = getSportPlugin(session.sportId);
  const first = plugin.standingsSort[0]?.field ?? 'wins';
  const byId = new Map(session.participants.map((p) => [p.playerId, p]));
  const changeById = new Map(changes.map((c) => [c.playerId, c]));

  const entries: CardEntry[] = standings
    .filter((s) => s.matchesPlayed > 0)
    .map((s) => {
      const p = byId.get(s.playerId);
      const change = changeById.get(s.playerId);
      const diff = s.pointDiff > 0 ? `+${s.pointDiff}` : String(s.pointDiff);
      return {
        playerId: s.playerId,
        rank: s.rank,
        name: p?.name ?? '?',
        nickname: p?.nickname ?? null,
        initials: initialsOf(p?.name ?? '?'),
        avatarColor: p?.avatarColor ?? 'transparent',
        primaryValue: num.format(first === 'points' ? s.pointsFor : first === 'wins' ? s.wins : s.pointDiff),
        secondary: t('board.record', { wins: s.wins, losses: s.losses, diff }),
        tier: change ? { key: change.to.tier, division: change.to.division, stars: change.to.stars } : null,
        rpDelta: change ? change.delta : null,
      };
    });

  return {
    kind: 'session',
    sportId: session.sportId,
    sportName: t(plugin.nameKey),
    title: session.title || t(plugin.nameKey),
    subtitle: session.venue,
    dateLabel: formatDateWithDay(session.playedAt, 'id'),
    dateIso: toIsoDate(session.playedAt),
    entries,
    totalPlayers: entries.length,
    metaLine: t('board.meta', { rounds: session.completedRoundCount, players: entries.length }),
    captions: captions(t),
  };
}

export function allTimeCardData(args: { sportId: SportId; rows: AllTimeRow[]; now: number; t: TFunction }): LeaderboardCardData {
  const { sportId, rows, now, t } = args;
  const plugin = getSportPlugin(sportId);
  const entries: CardEntry[] = rows.map((r) => ({
    playerId: r.playerId,
    rank: r.rank,
    name: r.name,
    nickname: r.nickname,
    initials: initialsOf(r.name),
    avatarColor: r.avatarColor,
    primaryValue: num.format(r.summary.rp),
    secondary: t('board.allTimeRecord', { wins: r.summary.wins, matches: r.summary.matchesPlayed, rate: Math.round(r.winRate * 100) }),
    tier: { key: r.summary.tier, division: r.summary.division, stars: r.summary.stars },
    rpDelta: null,
  }));
  return {
    kind: 'alltime',
    sportId,
    sportName: t(plugin.nameKey),
    title: t('board.allTimeTitle', { sport: t(plugin.nameKey) }),
    subtitle: null,
    dateLabel: formatDateWithDay(now, 'id'),
    dateIso: toIsoDate(now),
    entries,
    totalPlayers: entries.length,
    metaLine: t('board.allTimeMeta', { players: entries.length }),
    captions: captions(t),
  };
}

export function tierUpCardData(args: { session: SessionDoc; change: RankChange; t: TFunction }): TierUpCardData | null {
  const { session, change, t } = args;
  const p = session.participants.find((x) => x.playerId === change.playerId);
  if (!p) return null;
  const plugin = getSportPlugin(session.sportId);
  return {
    sportId: session.sportId,
    sportName: t(plugin.nameKey),
    playerName: p.nickname || p.name,
    initials: initialsOf(p.name),
    avatarColor: p.avatarColor,
    from: { key: change.from.tier, division: change.from.division },
    to: { key: change.to.tier, division: change.to.division, stars: change.to.stars },
    tierName: t(`rank.tier.${change.to.tier}`),
    headline: t('board.tierUpHeadline'),
    rpLabel: `${num.format(change.to.rp)} ${t('board.captions.rpUnit')}`,
    dateLabel: formatDateWithDay(session.playedAt, 'id'),
    dateIso: toIsoDate(session.playedAt),
    captions: { brand: t('common.appName'), madeWith: t('board.captions.madeWith') },
  };
}
