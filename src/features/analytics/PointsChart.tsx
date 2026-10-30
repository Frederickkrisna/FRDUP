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
import { pointsSeries } from '@/core/analytics/pointsSeries';
import type { AnalyticsWindow, PointsPoint } from '@/core/analytics/types';
import { formatDateShort } from '@/core/utils/date';
import { AccessibleChart } from './AccessibleChart';
import { ChartTooltip, type TooltipRow } from './ChartTooltip';
import {
  CHART_COLOR,
  formatAxisDate,
  formatDecimal,
  usePrefersReducedMotion,
} from './chartHelpers';

type Props = {
  results: PlayerSessionResultDoc[];
  window: AnalyticsWindow;
  height?: number;
};

const AXIS_TICK = { fill: CHART_COLOR.axis, fontSize: 11 } as const;

/** Points scored vs conceded per match, averaged per session. */
export function PointsChart({ results, window, height = 200 }: Props) {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const data = useMemo(() => pointsSeries(results, window), [results, window]);

  const summary = useMemo(() => buildSummary(data, t), [data, t]);
  const rows = useMemo(
    () =>
      data.map((p) => ({
        date: formatDateShort(p.playedAt),
        perMatchFor: formatDecimal(p.perMatchFor),
        perMatchAgainst: formatDecimal(p.perMatchAgainst),
      })),
    [data],
  );

  const renderTooltip = (_label: string, points: PointsPoint[]): TooltipRow[] => {
    const point = points[0];
    if (!point) return [];
    return [
      {
        label: t('analytics.points.perMatchFor'),
        value: formatDecimal(point.perMatchFor),
        color: CHART_COLOR.success,
      },
      {
        label: t('analytics.points.perMatchAgainst'),
        value: formatDecimal(point.perMatchAgainst),
        color: CHART_COLOR.danger,
      },
    ];
  };

  return (
    <AccessibleChart
      title={t('analytics.points.title')}
      summary={summary}
      tableCaption={t('analytics.points.tableCaption')}
      columns={[
        { key: 'date', header: t('analytics.table.date') },
        { key: 'perMatchFor', header: t('analytics.points.perMatchFor') },
        { key: 'perMatchAgainst', header: t('analytics.points.perMatchAgainst') },
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
            domain={[0, 'dataMax']}
            tickFormatter={(v: number) => formatDecimal(v)}
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
            dataKey="perMatchFor"
            stroke={CHART_COLOR.success}
            strokeWidth={2}
            dot={false}
            isAnimationActive={!reducedMotion}
          />
          <Line
            type="monotone"
            dataKey="perMatchAgainst"
            stroke={CHART_COLOR.danger}
            strokeWidth={2}
            dot={false}
            isAnimationActive={!reducedMotion}
          />
        </LineChart>
      </ResponsiveContainer>
    </AccessibleChart>
  );
}

function buildSummary(data: PointsPoint[], t: (key: string) => string): string {
  if (data.length === 0) return t('analytics.empty.noData');
  const latest = data[data.length - 1];
  if (!latest) return t('analytics.empty.noData');
  const diff = latest.perMatchFor - latest.perMatchAgainst;
  const direction =
    diff > 0 ? t('analytics.points.net.positive') : diff < 0 ? t('analytics.points.net.negative') : t('analytics.trend.flat');
  return `${t('analytics.points.summaryLatest')} ${formatDecimal(latest.perMatchFor)} / ${formatDecimal(latest.perMatchAgainst)}. ${direction}`;
}
