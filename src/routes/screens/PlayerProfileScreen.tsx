import { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StarTrack } from '@/components/StarTrack';
import { TierBadge } from '@/components/TierBadge';
import { Button } from '@/components/Button';
import { rpToPosition } from '@/core/ranking/computeRp';
import { TIER_MAP } from '@/core/ranking/ladder';
import { initialsOf } from '@/core/utils/avatar';
import { statsRepo } from '@/data/statsRepo';
import { PlayerAnalytics } from '@/features/analytics/PlayerAnalytics';
import { PlayerFormSheet } from '@/features/roster/PlayerFormSheet';
import { allSports } from '@/features/shared/sportMeta';
import { useAsync } from '@/features/shared/useAsync';
import { useAppStore } from '@/state/appStore';
import { useRosterStore } from '@/state/rosterStore';
import type { SportId } from '@/types/sport';

const num = new Intl.NumberFormat('id-ID');

export function PlayerProfileScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { playerId } = useParams();
  const hostId = useAppStore((s) => s.hostId);
  const lastSport = useAppStore((s) => s.lastSportId);
  const player = useRosterStore((s) => s.players.find((p) => p.id === playerId) ?? null);
  const status = useRosterStore((s) => s.status);

  const sports = allSports();
  const played = useMemo(() => sports.filter((s) => player?.summary[s.id]), [player, sports]);
  const [picked, setPicked] = useState<SportId | null>(null);
  const sportId: SportId = picked ?? (lastSport && played.some((s) => s.id === lastSport) ? lastSport : (played[0]?.id ?? lastSport ?? 'badminton'));
  const [editing, setEditing] = useState(false);

  const data = useAsync(async () => {
    if (!hostId || !playerId) return null;
    const [stats, results, events] = await Promise.all([
      statsRepo.getSportStats(hostId, playerId, sportId),
      statsRepo.listSessionResults(hostId, playerId, sportId, 20),
      statsRepo.listRpEvents(hostId, playerId, sportId, 60),
    ]);
    return { stats, results, events };
  }, [hostId, playerId, sportId]);

  if (!player) {
    return (
      <div>
        <ScreenHeader title={t('roster.title')} onBack={() => void navigate('/roster')} backLabel={t('common.back')} />
        {status === 'ready' ? <EmptyState art="players" title={t('roster.notFound')} /> : null}
      </div>
    );
  }

  const stats = data.data?.stats ?? null;
  const pos = rpToPosition(stats?.rp ?? player.summary[sportId]?.rp ?? 0);
  const tierDef = TIER_MAP[pos.tier];

  return (
    <div className="pb-6">
      <ScreenHeader
        title={player.nickname || player.name}
        subtitle={player.nickname ? player.name : undefined}
        onBack={() => void navigate(-1)}
        backLabel={t('common.back')}
        right={
          <button type="button" onClick={() => setEditing(true)} aria-label={t('common.edit')} className="pressable grid size-11 place-items-center rounded-full text-ink">
            <Pencil size={20} aria-hidden="true" />
          </button>
        }
      />

      <div className="flex flex-col gap-5 px-4 pt-5">
        <section className="flex flex-col items-center gap-2 text-center" aria-label={t('roster.profile.rank')}>
          <Avatar name={player.name} initials={initialsOf(player.name)} color={player.avatarColor} src={player.avatarUrl} size="lg" className="mb-1" />
          <TierBadge tier={pos.tier} division={pos.division} stars={pos.stars} size="hero" />
          <h2 className="text-[32px] font-extrabold leading-none" style={{ color: `var(--tier-${pos.tier})` }}>
            {t(`rank.tier.${pos.tier}`)}
            {pos.tier !== 'mythic' ? ` ${['', 'I', 'II', 'III', 'IV', 'V'][pos.division] ?? pos.division}` : ''}
          </h2>
          <div className="flex items-center gap-3">
            {pos.tier !== 'mythic' ? <StarTrack tier={pos.tier} filled={pos.stars} total={tierDef?.starsPerDivision ?? 3} size={18} /> : null}
            <span className="num text-[17px] font-semibold">{num.format(pos.rp)} {t('board.captions.rpUnit')}</span>
          </div>
          {pos.tier !== 'mythic' ? (
            <div className="w-full max-w-xs">
              <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos.progressPct * 100)} aria-label={t('rank.rpToNextStar', { rp: pos.rpToNextStar })}>
                <div className="h-full origin-left rounded-full transition-transform duration-300 ease-[var(--ease-out)]" style={{ transform: `scaleX(${pos.progressPct})`, backgroundColor: `var(--tier-${pos.tier})` }} />
              </div>
              <p className="num mt-1.5 text-[13px] text-ink-muted">{t('rank.rpToNextStar', { rp: pos.rpToNextStar })}</p>
            </div>
          ) : (
            <p className="num text-[13px] text-ink-muted">{t('rank.mythicPoints', { points: pos.mythicPoints ?? 0 })}</p>
          )}
        </section>

        <SegmentedControl<SportId>
          ariaLabel={t('roster.profile.sport')}
          value={sportId}
          onChange={setPicked}
          options={(played.length > 0 ? played : sports).map((s) => ({ value: s.id, label: t(s.nameKey) }))}
        />

        <PlayerAnalytics
          stats={data.data?.stats ?? null}
          results={data.data?.results ?? []}
          rpEvents={data.data?.events ?? []}
          loading={data.status === 'loading' && data.data === null}
          error={data.status === 'error'}
          onRetry={data.reload}
        />

        <Button variant="secondary" fullWidth onClick={() => void navigate(`/leaderboard/${sportId}`)}>
          {t('roster.profile.leaderboard')}
        </Button>
      </div>

      {hostId ? <PlayerFormSheet open={editing} onClose={() => setEditing(false)} hostId={hostId} player={player} onDeleted={() => void navigate('/roster', { replace: true })} /> : null}
    </div>
  );
}
