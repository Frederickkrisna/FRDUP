import { useMemo, useState } from 'react';
import { Share2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Podium, type PodiumItem } from '@/components/Podium';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SkeletonRows } from '@/components/Skeleton';
import { cn } from '@/components/cn';
import { computeStandings } from '@/core/standings/computeStandings';
import { getSportPlugin } from '@/core/sports/registry';
import { initialsOf } from '@/core/utils/avatar';
import { formatDateWithDay, formatElapsed } from '@/core/utils/date';
import { formatIdr } from '@/core/utils/idr';
import { billRepo, roundRepo, sessionRepo } from '@/data/sessionRepo';
import { BillExportButtons } from '@/features/billing/BillExportButtons';
import { roundingLine } from '@/features/billing/billExport';
import { sessionCardData } from '@/features/export/cardData';
import { ExportSheet } from '@/features/export/ExportSheet';
import { displayName } from '@/features/shared/people';
import { sportAccent } from '@/features/shared/sportMeta';
import { useAsync } from '@/features/shared/useAsync';
import { useHost } from '@/features/shared/useHost';
import { useAppStore } from '@/state/appStore';

/** Read-only recap of a finished session, plus re-export of the archived bill. */
export function HistoryDetailScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const hostId = useAppStore((s) => s.hostId);
  const host = useHost(hostId);
  const [sharing, setSharing] = useState(false);

  const data = useAsync(async () => {
    if (!sessionId) return null;
    const session = await sessionRepo.get(sessionId);
    if (!session) return null;
    const [rounds, bill] = await Promise.all([roundRepo.listBySession(sessionId), billRepo.get(sessionId)]);
    return { session, rounds, bill };
  }, [sessionId]);

  const computed = useMemo(() => {
    if (!data.data) return null;
    const { session, rounds } = data.data;
    const standings = computeStandings(session.participants, rounds, getSportPlugin(session.sportId), session.scoreInput).filter((s) => s.matchesPlayed > 0);
    return { standings, card: sessionCardData({ session, standings, changes: [], t }) };
  }, [data.data, t]);

  const back = () => void navigate('/history');

  if (data.status === 'loading' && !data.data) {
    return (
      <div>
        <ScreenHeader title={t('history.recap.title')} onBack={back} backLabel={t('common.back')} />
        <div className="px-4 pt-6"><SkeletonRows count={4} /></div>
      </div>
    );
  }
  if (data.status === 'error') {
    return (
      <div>
        <ScreenHeader title={t('history.recap.title')} onBack={back} backLabel={t('common.back')} />
        <EmptyState art="sessions" title={t('history.error.title')} body={t('history.error.body')} action={<Button onClick={data.reload}>{t('common.retry')}</Button>} />
      </div>
    );
  }
  if (!data.data || !computed) {
    return (
      <div>
        <ScreenHeader title={t('history.recap.title')} onBack={back} backLabel={t('common.back')} />
        <EmptyState art="search" title={t('session.notFound.title')} />
      </div>
    );
  }

  const { session, bill } = data.data;
  const { standings, card } = computed;
  const byId = new Map(session.participants.map((p) => [p.playerId, p]));
  const plugin = getSportPlugin(session.sportId);
  const podium: PodiumItem[] = standings
    .filter((s) => s.rank <= 3)
    .slice(0, 3)
    .map((s, i) => {
      const p = byId.get(s.playerId);
      return { key: s.playerId, rank: (i + 1) as 1 | 2 | 3, name: p ? displayName(p) : '?', initials: initialsOf(p?.name ?? '?'), color: p?.avatarColor ?? 'transparent', value: `${s.pointsFor} ${t('session.finish.pointsShort')}` };
    });

  return (
    <div className="pb-8">
      <ScreenHeader
        title={session.title || t(plugin.nameKey)}
        subtitle={[t(plugin.nameKey), formatDateWithDay(session.playedAt, 'id')].join(' · ')}
        accent={sportAccent(session.sportId)}
        onBack={back}
        backLabel={t('common.back')}
        right={
          <Button size="sm" variant="secondary" leftIcon={<Share2 size={16} aria-hidden="true" />} disabled={card.entries.length === 0} onClick={() => setSharing(true)}>
            {t('common.share')}
          </Button>
        }
      />

      <div className="flex flex-col gap-6 px-4 pt-5">
        <dl className="num grid grid-cols-3 gap-2 text-center">
          {[
            [t('history.recap.rounds'), session.completedRoundCount],
            [t('history.recap.players'), session.participants.length],
            [t('history.recap.duration'), formatElapsed(session.playedAt, session.finishedAt ?? session.updatedAt)],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-line bg-surface p-3">
              <dt className="text-[12px] text-ink-muted">{label}</dt>
              <dd className="mt-1 text-[20px] font-bold">{value}</dd>
            </div>
          ))}
        </dl>

        {podium.length > 0 ? <Podium items={podium} rankLabel={(r) => t('board.rankLabel', { rank: r })} /> : <EmptyState art="chart" title={t('session.standings.noData')} />}

        {standings.length > 0 ? (
          <section aria-labelledby="rc-standings">
            <h2 id="rc-standings" className="mb-2 text-[20px] font-extrabold">
              {t('session.standings.title')}
            </h2>
            <ol className="flex flex-col gap-1.5">
              {standings.map((s) => {
                const p = byId.get(s.playerId);
                return (
                  <li key={s.playerId} className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface px-3">
                    <span className="num w-6 text-center text-[16px] font-bold text-ink-muted">{s.rank}</span>
                    {p ? <Avatar name={p.name} initials={initialsOf(p.name)} color={p.avatarColor} size="xs" /> : null}
                    <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{p ? displayName(p) : '?'}</span>
                    <span className="num text-[13px] text-ink-muted">
                      {s.wins}-{s.losses}
                    </span>
                    <span className="num w-10 text-right text-[16px] font-bold">{s.pointsFor}</span>
                    <span className={cn('num w-9 text-right text-[13px]', s.pointDiff > 0 ? 'text-success' : s.pointDiff < 0 ? 'text-danger' : 'text-ink-muted')}>{s.pointDiff > 0 ? `+${s.pointDiff}` : s.pointDiff}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {bill && bill.items.length > 0 && host ? (
          <section aria-labelledby="rc-bill" className="flex flex-col gap-3">
            <h2 id="rc-bill" className="text-[20px] font-extrabold">
              {t('history.recap.viewBill')}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {bill.settlements.map((s) => (
                <li key={s.playerId} className="num flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-[15px]">
                  <span className="truncate pr-3 font-sans font-semibold">{byId.get(s.playerId) ? displayName(byId.get(s.playerId) as NonNullable<ReturnType<typeof byId.get>>) : s.name}</span>
                  <span className="font-bold">{formatIdr(s.rounded)}</span>
                </li>
              ))}
            </ul>
            <p className="num flex justify-between text-[15px]">
              <span className="font-semibold">{t('bill.total')}</span>
              <span className="font-bold">{formatIdr(bill.totals.gross)}</span>
            </p>
            {roundingLine(bill, t) ? <p className="num text-[13px] text-ink-muted">{roundingLine(bill, t)}</p> : null}
            <BillExportButtons session={session} bill={bill} host={host} standings={standings} />
          </section>
        ) : null}
      </div>

      <ExportSheet open={sharing} onClose={() => setSharing(false)} data={card} />
    </div>
  );
}
