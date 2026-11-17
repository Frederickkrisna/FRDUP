import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Calendar, MapPin, Share2, Trophy } from 'lucide-react';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Podium, type PodiumItem } from '@/components/Podium';
import { SkeletonRows } from '@/components/Skeleton';
import { TierBadge } from '@/components/TierBadge';
import { toast } from '@/components/toast/toastStore';
import { cn } from '@/components/cn';
import { formatDateWithDay } from '@/core/utils/date';
import { initialsOf } from '@/core/utils/avatar';
import { getSportPlugin } from '@/core/sports/registry';
import { publicBoardRepo } from '@/data/publicBoardRepo';
import { SportIcon, sportAccent } from '@/features/shared/sportMeta';
import type { PublicBoardDoc } from '@/types/publicBoard';
import type { SportId } from '@/types/sport';

export function PublicBoardScreen() {
  const { t, i18n } = useTranslation();
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();

  const [board, setBoard] = useState<PublicBoardDoc | null>(null);
  const [loading, setLoading] = useState(Boolean(boardId));

  useEffect(() => {
    if (!boardId) return;
    let active = true;
    publicBoardRepo
      .get(boardId)
      .then((doc) => {
        if (active) {
          setBoard(doc);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [boardId]);

  const handleShare = async () => {
    const url = window.location.href;
    const sportName = board ? t(`sports.${board.sportId}.name`) : '';
    if (navigator.share) {
      try {
        await navigator.share({
          title: board?.title || t('board.public.title'),
          text: t('board.public.shareText', { sport: sportName }),
          url,
        });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.info(t('board.public.copied'));
    } catch {
      toast.danger(t('session.finish.shareFailed'));
    }
  };

  if (loading) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[560px] px-4 py-8">
        <div className="mb-6 flex flex-col gap-2">
          <div className="h-6 w-32 animate-pulse rounded bg-surface-2" />
          <div className="h-8 w-48 animate-pulse rounded bg-surface-2" />
        </div>
        <SkeletonRows count={6} />
      </main>
    );
  }

  if (!board) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[560px] px-4 py-16">
        <EmptyState
          art="chart"
          title={t('board.public.notFoundTitle')}
          body={t('board.public.notFoundBody')}
          action={
            <Button onClick={() => void navigate('/home', { replace: true })}>
              {t('board.public.createSession')}
            </Button>
          }
        />
      </main>
    );
  }

  const locale = (i18n.language === 'en' ? 'en' : 'id') as 'id' | 'en';
  const sportId = board.sportId as SportId;
  const accent = sportAccent(sportId);
  const sportName = t(`sports.${sportId}.name`);

  const podium: PodiumItem[] = board.entries
    .filter((e) => e.rank <= 3)
    .slice(0, 3)
    .map((e) => ({
      key: e.playerId,
      rank: e.rank as 1 | 2 | 3,
      name: e.nickname || e.name,
      initials: initialsOf(e.name),
      color: e.avatarColor,
      value: `${e.pointsFor} ${t('session.standings.points')}`,
      badge: <TierBadge tier={e.tierAfter} division={e.divisionAfter} size="sm" />,
    }));

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[560px] pb-32">
      {/* Header */}
      <header className="border-b border-line bg-surface px-4 py-5">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
              <Trophy size={16} aria-hidden="true" />
            </div>
            <span className="font-extrabold tracking-tight text-ink">{t('common.appName')}</span>
          </div>
          <Chip accent={accent}>
            <span className="flex items-center gap-1.5 font-medium">
              <SportIcon name={getSportPlugin(sportId).icon} size={14} />
              {sportName}
            </span>
          </Chip>
        </div>

        <h1 className="text-[22px] font-extrabold leading-tight text-ink">
          {board.title || t('board.public.title')}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-ink-muted">
          <span className="flex items-center gap-1">
            <Calendar size={14} aria-hidden="true" />
            {formatDateWithDay(board.playedAt, locale)}
          </span>
          {board.venue ? (
            <span className="flex items-center gap-1">
              <MapPin size={14} aria-hidden="true" />
              {board.venue}
            </span>
          ) : null}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col gap-6 px-4 pt-6">
        {/* Podium */}
        {podium.length > 0 ? (
          <section aria-labelledby="podium-heading">
            <h2 id="podium-heading" className="sr-only">
              {t('session.finish.podium')}
            </h2>
            <Podium items={podium} rankLabel={(r) => t('board.rankLabel', { rank: r })} />
          </section>
        ) : null}

        {/* Full Rankings */}
        <section aria-labelledby="rankings-heading" className="flex flex-col gap-2">
          <h2 id="rankings-heading" className="text-[17px] font-bold text-ink">
            {t('board.public.title')}
          </h2>

          <ol className="flex flex-col gap-1.5">
            {board.entries.map((entry) => {
              const losses = Math.max(0, entry.matchesPlayed - entry.wins);
              const winRate = Math.round(entry.winRate * 100);
              return (
                <li
                  key={entry.playerId}
                  className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2"
                >
                  <span className="num w-6 shrink-0 text-center text-[16px] font-bold text-ink-muted">
                    {entry.rank}
                  </span>
                  <Avatar
                    name={entry.name}
                    initials={initialsOf(entry.name)}
                    color={entry.avatarColor}
                    size="xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-tight text-ink">
                      {entry.nickname || entry.name}
                    </p>
                    <p className="num text-[12px] text-ink-muted">
                      {t('board.stats', {
                        wins: entry.wins,
                        losses,
                        winRate,
                        matches: entry.matchesPlayed,
                      })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'num shrink-0 text-[15px] font-bold',
                      entry.rpDelta > 0
                        ? 'text-success'
                        : entry.rpDelta < 0
                          ? 'text-danger'
                          : 'text-ink-muted',
                    )}
                  >
                    {entry.rpDelta > 0
                      ? `+${entry.rpDelta}`
                      : entry.rpDelta === 0
                        ? t('session.finish.noChange')
                        : entry.rpDelta}
                  </span>
                  <TierBadge tier={entry.tierAfter} division={entry.divisionAfter} size="sm" />
                </li>
              );
            })}
          </ol>
        </section>

        {/* Promo card */}
        <section className="rounded-xl border border-line bg-surface-2 p-4 text-center">
          <p className="text-[14px] font-bold text-ink">{t('board.public.createSession')}</p>
          <p className="mt-1 text-[12px] text-ink-muted">{t('board.public.tagline')}</p>
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowRight size={14} aria-hidden="true" />}
              onClick={() => void navigate('/', { replace: true })}
            >
              {t('board.public.createSession')}
            </Button>
          </div>
        </section>
      </main>

      {/* Floating Bottom Bar */}
      <footer className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[560px] border-t border-line bg-surface/95 p-3 backdrop-blur-md">
        <Button
          size="lg"
          fullWidth
          leftIcon={<Share2 size={18} aria-hidden="true" />}
          onClick={() => void handleShare()}
        >
          {t('board.public.shareAction')}
        </Button>
      </footer>
    </div>
  );
}
