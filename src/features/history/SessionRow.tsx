import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { formatDateShort } from '@/core/utils/date';
import { SportIcon, sportAccent } from '@/features/shared/sportMeta';
import { getSportPlugin } from '@/core/sports/registry';
import type { SessionDoc } from '@/types/session';

/** History/Home row. The sport tint is a small icon tile — never a coloured side stripe. */
export const SessionRow = memo(function SessionRow({ session, index = 0 }: { session: SessionDoc; index?: number }) {
  const { t } = useTranslation();
  const plugin = getSportPlugin(session.sportId);
  const sport = t(plugin.nameKey);
  return (
    <li className="rise-in [content-visibility:auto] [contain-intrinsic-size:auto_72px]" style={{ '--i': Math.min(index, 8) } as React.CSSProperties}>
      <Link to={`/history/${session.id}`} className="pressable pressable-hover flex min-h-[72px] items-center gap-3 rounded-lg px-2 py-2">
        <span className="grid size-12 shrink-0 place-items-center rounded-md border border-line bg-surface-2" style={{ color: sportAccent(session.sportId) }}>
          <SportIcon name={plugin.icon} size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold leading-tight">{session.title || sport}</p>
          <p className="truncate text-[13px] text-ink-muted">
            {[session.title ? sport : null, formatDateShort(session.playedAt), t('history.row.meta', { rounds: session.completedRoundCount, players: session.participants.length })]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden="true" />
      </Link>
    </li>
  );
});
