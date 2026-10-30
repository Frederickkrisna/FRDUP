import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Avatar } from '@/components/Avatar';
import { TierBadge } from '@/components/TierBadge';
import { initialsOf } from '@/core/utils/avatar';
import type { RosterPlayerDoc } from '@/types/player';
import type { SportId } from '@/types/sport';

type Props = {
  player: RosterPlayerDoc;
  sportId: SportId | null;
  index?: number;
};

/** One roster row: 64px tall, whole row is the tap target. Memoised so typing in search stays cheap. */
export const PlayerRow = memo(function PlayerRow({ player, sportId, index = 0 }: Props) {
  const { t } = useTranslation();
  const summary = sportId ? player.summary[sportId] : undefined;
  const archived = player.archivedAt !== null;
  return (
    <li className="rise-in [content-visibility:auto] [contain-intrinsic-size:auto_64px]" style={{ '--i': Math.min(index, 8) } as React.CSSProperties}>
      <Link
        to={`/roster/${player.id}`}
        className="pressable flex min-h-16 items-center gap-3 rounded-lg border border-transparent px-2 py-2 pressable-hover"
        aria-label={player.name}
      >
        <Avatar name={player.name} initials={initialsOf(player.name)} color={player.avatarColor} src={player.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold leading-tight">{player.name}</p>
          <p className="truncate text-[13px] text-ink-muted">
            {[
              player.nickname,
              player.isGuest ? t('roster.guestTag') : null,
              archived ? t('roster.archivedTag') : null,
              summary ? t('roster.matchesCount', { count: summary.matchesPlayed }) : null,
            ]
              .filter(Boolean)
              .join(' · ') || t('roster.noMatchesYet')}
          </p>
        </div>
        {summary ? <TierBadge tier={summary.tier} division={summary.division} stars={summary.stars} size="sm" /> : null}
        <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden="true" />
      </Link>
    </li>
  );
});
