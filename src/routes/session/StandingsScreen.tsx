import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/components/cn';
import { computeSessionRp } from '@/core/ranking/computeRp';
import { initialsOf } from '@/core/utils/avatar';
import { displayName } from '@/features/shared/people';
import { useParticipantMap, useStandings } from '@/features/session/selectors';
import { useSessionStore } from '@/state/sessionStore';
import type { StandingRow } from '@/core/matchmaking/types';

type SortKey = 'rank' | 'matchesPlayed' | 'wins' | 'pointsFor' | 'pointDiff' | 'winRate';

/**
 * Fixed widths sized for a 360px phone: the player column keeps >= 120px for the name, numbers
 * never wrap or spill into the next column. The draws column only exists when a sport produced one.
 */
const COLS: Array<{ key: SortKey; label: string; aria: string; width: string }> = [
  { key: 'matchesPlayed', label: 'session.standings.playedShort', aria: 'session.standings.playedFull', width: 'w-10' },
  { key: 'wins', label: 'session.standings.record', aria: 'session.standings.winsFull', width: 'w-[52px]' },
  { key: 'pointsFor', label: 'session.standings.points', aria: 'session.standings.pointsFull', width: 'w-11' },
  { key: 'pointDiff', label: 'session.standings.diff', aria: 'session.standings.diffFull', width: 'w-11' },
];

export function StandingsScreen() {
  const { t } = useTranslation();
  const standings = useStandings();
  const byId = useParticipantMap();
  const session = useSessionStore((s) => s.session);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'rank', dir: 'asc' });

  const rows = useMemo(() => {
    const list = [...standings];
    const sign = sort.dir === 'asc' ? 1 : -1;
    // Rank order is already the plugin's order; other columns re-sort on top of it (stable).
    if (sort.key !== 'rank') list.sort((a, b) => sign * (a[sort.key] - b[sort.key]) || a.rank - b.rank);
    else if (sort.dir === 'desc') list.reverse();
    return list;
  }, [standings, sort]);

  const rankedCount = useMemo(() => standings.filter((s) => s.matchesPlayed > 0 && byId.get(s.playerId)?.includeInRanking).length, [standings, byId]);
  const projected = (row: StandingRow): number | null => {
    const p = byId.get(row.playerId);
    if (!p?.includeInRanking || row.matchesPlayed === 0) return null;
    return computeSessionRp({ standing: row, participantCount: Math.max(1, rankedCount), streakSessions: 0 }).delta;
  };

  const hasDraws = standings.some((s) => s.draws > 0);

  if (!session) return null;
  if (standings.every((s) => s.matchesPlayed === 0)) return <EmptyState art="chart" title={t('session.standings.noData')} body={t('session.standings.noDataBody')} />;

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
  const ariaSort = (key: SortKey): 'ascending' | 'descending' | 'none' => (sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');

  return (
    <div className="px-3 pt-3">
      <table className="w-full table-fixed border-separate border-spacing-0">
        <caption className="sr-only">{t('session.standings.title')}</caption>
        <thead className="sticky top-14 z-10 bg-bg">
          <tr className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            <th scope="col" aria-sort={ariaSort('rank')} className="w-8 py-2 text-center">
              <button type="button" onClick={() => toggle('rank')} className="pressable min-h-11 w-full" aria-label={t('session.standings.rankFull')}>
                {t('session.standings.rank')}
              </button>
            </th>
            <th scope="col" className="py-2 pl-1 text-left">
              {t('session.standings.player')}
            </th>
            {COLS.map((c) => (
              <th key={c.key} scope="col" aria-sort={ariaSort(c.key)} className={cn('py-2 text-center', c.key === 'wins' && hasDraws ? 'w-16' : c.width)}>
                <button type="button" onClick={() => toggle(c.key)} className="pressable inline-flex min-h-11 w-full items-center justify-center gap-0.5 whitespace-nowrap text-[11px] font-bold" aria-label={t(c.aria)}>
                  {c.key === 'wins' && hasDraws ? t('session.standings.recordDraws') : t(c.label)}
                  {sort.key === c.key ? sort.dir === 'desc' ? <ArrowDown size={11} aria-hidden="true" /> : <ArrowUp size={11} aria-hidden="true" /> : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = byId.get(r.playerId);
            if (!p) return null;
            const delta = projected(r);
            const top = r.rank <= 3 && r.matchesPlayed > 0;
            return (
              <tr key={r.playerId} className={cn('h-14 text-[15px]', top && 'bg-surface')}>
                <th scope="row" className="num rounded-l-md text-center text-[16px] font-bold" style={top ? { color: `var(--tier-${r.rank === 1 ? 'legend' : r.rank === 2 ? 'elite' : 'warrior'})` } : undefined}>
                  {r.rank}
                </th>
                <td className="py-1 pl-1 pr-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={p.name} initials={initialsOf(p.name)} color={p.avatarColor} src={p.avatarUrl} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold leading-tight">{displayName(p)}</p>
                      {delta !== null ? (
                        <p className="truncate text-[11px] leading-tight text-ink-muted" title={t('session.standings.projectedHint')}>
                          {t('session.standings.projected', { delta: delta > 0 ? `+${delta}` : String(delta) })}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="num text-center text-[14px]">{r.matchesPlayed}</td>
                <td className="num whitespace-nowrap text-center text-[13px] font-medium tracking-tight">
                  {hasDraws ? `${r.wins}-${r.losses}-${r.draws}` : `${r.wins}-${r.losses}`}
                </td>
                <td className="num text-center font-bold text-[14px]">{r.pointsFor}</td>
                <td className={cn('num rounded-r-md text-center text-[13px]', r.pointDiff > 0 ? 'text-success font-semibold' : r.pointDiff < 0 ? 'text-danger font-semibold' : 'text-ink-muted')}>{r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-2 pt-3 text-[12px] text-ink-faint">{t('session.standings.projectedHint')}</p>
    </div>
  );
}
