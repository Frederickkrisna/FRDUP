import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PlayerSessionResultDoc } from '@/types/player';
import { winRateSeries } from '@/core/analytics/winRateSeries';
import type { AnalyticsWindow, WinRatePoint } from '@/core/analytics/types';
import { formatDateShort } from '@/core/utils/date';
import { AccessibleChart } from './AccessibleChart';
import { ChartTooltip, type TooltipRow } from './ChartTooltip';
import {
  CHART_COLOR,
  formatAxisDate,
  formatPct,
  usePrefersReducedMotion,
} from './chartHelpers';

type Props = {
  results: PlayerSessionResultDoc[];
  window: AnalyticsWindow;
  height?: number;
};

const AXIS_TICK = { fill: CHART_COLOR.axis, fontSize: 11 } as const;

/** Win-rate over the most recent sessions: per-session bars of truth plus a cumulative line. */
export function WinRateChart({ results, window, height = 200 }: Props) {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const data = useMemo(() => winRateSeries(results, window), [results, window]);

  const summary = useMemo(() => buildSummary(data, t), [data, t]);
  const rows = useMemo(
    () =>
      data.map((p) => ({
        date: formatDateShort(p.playedAt),
        winRate: formatPct(p.winRate),
        cumulative: formatPct(p.cumulativeWinRate),
      })),
    [data],
  );

  const renderTooltip = (label: string, points: WinRatePoint[]): TooltipRow[] => {
    const point = points[0];
    if (!point) return [];
    return [
      { label: t('analytics.winRate.session'), value: formatPct(point.winRate), color: CHART_COLOR.info },
      {
        label: t('analytics.winRate.cumulative'),
        value: formatPct(point.cumulativeWinRate),
        color: CHART_COLOR.primary,
      },
    ];
  };

  return (
    <AccessibleChart
      title={t('analytics.winRate.title')}
      summary={summary}
      tableCaption={t('analytics.winRate.tableCaption')}
      columns={[
        { key: 'date', header: t('analytics.table.date') },
        { key: 'winRate', header: t('analytics.winRate.session') },
        { key: 'cumulative', header: t('analytics.winRate.cumulative') },
      ]}
      rows={rows}
    >
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={CHART_COLOR.grid} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="playedAt"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={formatAxisDate}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: CHART_COLOR.grid }}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v: number) => formatPct(v)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            isAnimationActive={!reducedMotion}
            cursor={{ stroke: CHART_COLOR.line }}
            content={
              <ChartTooltip
                labelFormatter={(label) => formatDateShort(Number(label))}
                rowsFromPayload={renderTooltip}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="cumulativeWinRate"
            stroke={CHART_COLOR.primary}
            strokeWidth={2}
            dot={false}
            isAnimationActive={!reducedMotion}
          />
          <Line
            type="monotone"
            dataKey="winRate"
            stroke={CHART_COLOR.info}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            dot={false}
            isAnimationActive={!reducedMotion}
          />
        </LineChart>
      </ResponsiveContainer>
    </AccessibleChart>
  );
}

function buildSummary(data: WinRatePoint[], t: (key: string) => string): string {
  if (data.length === 0) return t('analytics.empty.noData');
  const latest = data[data.length - 1];
  const first = data[0];
  if (!latest || !first) return t('analytics.empty.noData');
  const direction =
    latest.cumulativeWinRate > first.cumulativeWinRate
      ? t('analytics.trend.up')
      : latest.cumulativeWinRate < first.cumulativeWinRate
        ? t('analytics.trend.down')
        : t('analytics.trend.flat');
  return `${t('analytics.winRate.summaryLatest')} ${formatPct(latest.cumulativeWinRate)}. ${direction}`;
}
