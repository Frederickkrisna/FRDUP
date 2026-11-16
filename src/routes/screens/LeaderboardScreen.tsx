import { useMemo, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Podium, type PodiumItem } from '@/components/Podium';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SkeletonRows } from '@/components/Skeleton';
import { TierBadge } from '@/components/TierBadge';
import { Avatar } from '@/components/Avatar';
import { allTimeRows } from '@/core/leaderboard/allTime';
import { initialsOf } from '@/core/utils/avatar';
import { allTimeCardData } from '@/features/export/cardData';
import { ExportSheet } from '@/features/export/ExportSheet';
import { allSports, sportAccent } from '@/features/shared/sportMeta';
import { useNow } from '@/features/shared/useNow';
import { useAppStore } from '@/state/appStore';
import { useRosterStore } from '@/state/rosterStore';
import type { SportId } from '@/types/sport';

const num = new Intl.NumberFormat('id-ID');

/** All-time ladder for one sport, built from roster summaries (denormalised: zero extra reads). */
export function LeaderboardScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const lastSport = useAppStore((s) => s.lastSportId);
  const players = useRosterStore((s) => s.players);
  const status = useRosterStore((s) => s.status);
  const [sharing, setSharing] = useState(false);
  const now = useNow(60_000);

  const valid = allSports().find((s) => s.id === params['sportId'])?.id;
  const sportId: SportId = valid ?? lastSport ?? 'badminton';
  const rows = useMemo(() => allTimeRows(players, sportId), [players, sportId]);
  const cardData = useMemo(() => allTimeCardData({ sportId, rows, now, t }), [sportId, rows, now, t]);

  const podium: PodiumItem[] = rows
    .filter((r) => r.rank <= 3)
    .slice(0, 3)
    .map((r, i) => ({
      key: r.playerId,
      rank: (Math.min(3, Math.max(1, i + 1))) as 1 | 2 | 3,
      name: r.nickname || r.name,
      initials: initialsOf(r.name),
      color: r.avatarColor,
      src: r.avatarUrl,
      value: `${num.format(r.summary.rp)} RP`,
      badge: <TierBadge tier={r.summary.tier} division={r.summary.division} stars={r.summary.stars} size="sm" />,
    }));

  return (
    <div className="pb-6">
      <ScreenHeader
        title={t('board.title')}
        subtitle={t(allSports().find((s) => s.id === sportId)?.nameKey ?? 'common.allSports')}
        accent={sportAccent(sportId)}
        onBack={() => void navigate(-1)}
        backLabel={t('common.back')}
        right={
          <Button size="sm" variant="secondary" disabled={rows.length === 0} leftIcon={<Share2 size={16} aria-hidden="true" />} onClick={() => setSharing(true)}>
            {t('common.share')}
          </Button>
        }
      />

      <div className="hide-scrollbar flex gap-2 overflow-x-auto px-4 pt-4" role="group" aria-label={t('history.filterBySport')}>
        {allSports().map((s) => (
          <Chip key={s.id} selected={sportId === s.id} accent={sportAccent(s.id)} onClick={() => void navigate(`/leaderboard/${s.id}`, { replace: true })}>
            {t(s.nameKey)}
          </Chip>
        ))}
      </div>

      <section className="px-4 pt-5" aria-busy={status !== 'ready'}>
        {status !== 'ready' ? (
          <SkeletonRows count={5} />
        ) : rows.length === 0 ? (
          <EmptyState art="chart" title={t('board.empty.title')} body={t('board.empty.body')} />
        ) : (
          <>
            {podium.length > 0 ? <Podium items={podium} rankLabel={(r) => t('board.rankLabel', { rank: r })} /> : null}
            <ol className="mt-5 flex flex-col">
              {rows.map((r) => {
                const wins = r.summary.wins;
                const matches = r.summary.matchesPlayed;
                const losses = Math.max(0, matches - wins);
                const winRate = Math.round(r.winRate * 100);
                return (
                  <li key={r.playerId} className="[content-visibility:auto] [contain-intrinsic-size:auto_64px]">
                    <Link to={`/roster/${r.playerId}`} className="pressable pressable-hover flex min-h-16 items-center gap-2.5 rounded-lg px-1.5 py-2">
                      <span className="num w-6 shrink-0 text-center text-[16px] font-bold text-ink-muted">{r.rank}</span>
                      <Avatar name={r.name} initials={initialsOf(r.name)} color={r.avatarColor} src={r.avatarUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold leading-tight">{r.nickname || r.name}</p>
                        <p className="num mt-0.5 truncate text-[12px] text-ink-muted">
                          {t('board.stats', { wins, losses, winRate, matches })}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end leading-none">
                        <span className="num text-[15px] font-bold">{num.format(r.summary.rp)}</span>
                        <span className="mt-1 text-[11px] font-semibold text-ink-faint">{t('board.rpUnit')}</span>
                      </div>
                      <TierBadge tier={r.summary.tier} division={r.summary.division} stars={r.summary.stars} size="sm" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>

      <ExportSheet open={sharing} onClose={() => setSharing(false)} data={cardData} />
    </div>
  );
}
