import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlayerSessionResultDoc, PlayerSportStatsDoc } from '@/types/player';
import type { RpEventDoc } from '@/types/stats';
import type { AnalyticsWindow } from '@/core/analytics/types';
import { profileSummary, hasEnoughData } from '@/core/analytics/profileSummary';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Skeleton } from '@/components/Skeleton';
import { StatTile } from '@/components/StatTile';
import { LazyPointsChart, LazyRpHistoryChart, LazyWinRateChart } from './LazyCharts';
import { formatInt, formatPct } from './chartHelpers';

type Props = {
  stats: PlayerSportStatsDoc | null;
  results: PlayerSessionResultDoc[];
  rpEvents: RpEventDoc[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

const WINDOW_OPTIONS: AnalyticsWindow[] = [5, 10, 20];

/**
 * Composed analytics section for a player profile. Receives plain data props (no
 * Firestore access) so the routes layer feeds it and it stays unit-testable.
 */
export function PlayerAnalytics({ stats, results, rpEvents, loading = false, error = false, onRetry }: Props) {
  const { t } = useTranslation();
  const [window, setWindow] = useState<AnalyticsWindow>(10);

  const summary = useMemo(() => profileSummary(stats), [stats]);
  const enoughData = useMemo(() => hasEnoughData(results), [results]);

  if (loading) {
    return <AnalyticsSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        <p className="text-[15px] text-ink-muted">{t('analytics.error.body')}</p>
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        ) : null}
      </div>
    );
  }

  const windowOptions = WINDOW_OPTIONS.map((w) => ({
    value: String(w),
    label: t('analytics.window.lastN', { count: w }),
  }));

  return (
    <section className="flex flex-col gap-6" aria-label={t('analytics.section.label')}>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label={t('analytics.stat.matches')} value={<span className="num">{formatInt(summary.matches)}</span>} />
        <StatTile label={t('analytics.stat.winRate')} value={<span className="num">{formatPct(summary.winRatePct / 100)}</span>} />
        <StatTile label={t('analytics.stat.sessions')} value={<span className="num">{formatInt(summary.sessions)}</span>} />
        <StatTile label={t('analytics.stat.peakRp')} value={<span className="num">{formatInt(summary.peakRp)}</span>} />
      </div>

      {enoughData ? (
        <>
          <div className="flex flex-col gap-3">
            <SegmentedControl
              options={windowOptions}
              value={String(window)}
              onChange={(v) => setWindow(Number(v) as AnalyticsWindow)}
              ariaLabel={t('analytics.window.label')}
            />
            <ChartCard title={t('analytics.winRate.title')}>
              <LazyWinRateChart results={results} window={window} />
            </ChartCard>
            <ChartCard title={t('analytics.points.title')}>
              <LazyPointsChart results={results} window={window} />
            </ChartCard>
          </div>

          <ChartCard title={t('analytics.rp.title')}>
            <LazyRpHistoryChart events={rpEvents} />
          </ChartCard>
        </>
      ) : (
        <EmptyState art="chart" title={t('analytics.empty.title')} body={t('analytics.empty.body')} />
      )}
    </section>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h3 className="mb-2 text-[14px] font-semibold text-ink-muted">{title}</h3>
      {children}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <section className="flex flex-col gap-6" aria-busy="true">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[92px] w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-md" />
      <Skeleton className="h-[200px] w-full rounded-lg" />
      <Skeleton className="h-[200px] w-full rounded-lg" />
      <Skeleton className="h-[220px] w-full rounded-lg" />
    </section>
  );
}
