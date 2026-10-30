import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RpEventDoc } from '@/types/stats';
import { rpSeries, tierBands } from '@/core/analytics/rpSeries';
import type { RpPoint } from '@/core/analytics/types';
import { TIER_MAP } from '@/core/ranking/ladder';
import { formatDateShort } from '@/core/utils/date';
import { AccessibleChart } from './AccessibleChart';
import { ChartTooltip, type TooltipRow } from './ChartTooltip';
import {
  CHART_COLOR,
  formatAxisDate,
  formatInt,
  tierColor,
  usePrefersReducedMotion,
} from './chartHelpers';

type Props = {
  events: RpEventDoc[];
  height?: number;
};

const AXIS_TICK = { fill: CHART_COLOR.axis, fontSize: 11 } as const;

/** Rank-point history as a step line over tier-coloured background bands. */
export function RpHistoryChart({ events, height = 220 }: Props) {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const data = useMemo(() => rpSeries(events), [events]);

  const maxRp = useMemo(() => data.reduce((m, p) => Math.max(m, p.rpAfter), 0), [data]);
  // Pad the ceiling a little so the top band and the line are not flush with the frame.
  const bands = useMemo(() => tierBands(Math.max(maxRp * 1.08, 50)), [maxRp]);
  const yMax = useMemo(() => Math.max(maxRp * 1.08, 50), [maxRp]);

  const summary = useMemo(() => buildSummary(data, t), [data, t]);
  const rows = useMemo(
    () =>
      data.map((p) => ({
        date: formatDateShort(p.createdAt),
        rp: formatInt(p.rpAfter),
        tier: t(TIER_MAP[p.tierAfter].nameKey),
        delta: `${p.delta >= 0 ? '+' : ''}${formatInt(p.delta)}`,
        reason: p.reverted ? t('analytics.rp.reverted') : '',
      })),
    [data, t],
  );

  const renderTooltip = (_label: string, points: RpPoint[]): TooltipRow[] => {
    const point = points[0];
    if (!point) return [];
    const base: TooltipRow[] = [
      { label: t('analytics.rp.value'), value: formatInt(point.rpAfter), color: CHART_COLOR.primary },
      {
        label: t('analytics.rp.delta'),
        value: `${point.delta >= 0 ? '+' : ''}${formatInt(point.delta)}`,
        color: point.delta >= 0 ? CHART_COLOR.success : CHART_COLOR.danger,
      },
      { label: t('analytics.rp.tier'), value: t(TIER_MAP[point.tierAfter].nameKey), color: tierColor(point.tierAfter) },
    ];
    if (point.reverted) {
      base.push({ label: t('analytics.rp.reason'), value: t('analytics.rp.reverted'), color: CHART_COLOR.warning });
    }
    return base;
  };

  return (
    <AccessibleChart
      title={t('analytics.rp.title')}
      summary={summary}
      tableCaption={t('analytics.rp.tableCaption')}
      columns={[
        { key: 'date', header: t('analytics.table.date') },
        { key: 'rp', header: t('analytics.rp.value') },
        { key: 'tier', header: t('analytics.rp.tier') },
        { key: 'delta', header: t('analytics.rp.delta') },
        { key: 'reason', header: t('analytics.rp.reason') },
      ]}
      rows={rows}
    >
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={CHART_COLOR.grid} strokeDasharray="2 4" vertical={false} />
          {bands.map((band) => (
            <ReferenceArea
              key={band.tier}
              y1={band.from}
              y2={band.to}
              fill={tierColor(band.tier)}
              fillOpacity={0.1}
              stroke="none"
              ifOverflow="hidden"
            />
          ))}
          <XAxis
            dataKey="createdAt"
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
            domain={[0, yMax]}
            tickFormatter={(v: number) => formatInt(v)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={48}
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
            type="stepAfter"
            dataKey="rpAfter"
            stroke={CHART_COLOR.primary}
            strokeWidth={2}
            dot={{ r: 2, fill: CHART_COLOR.primary, stroke: 'none' }}
            activeDot={{ r: 4 }}
            isAnimationActive={!reducedMotion}
          />
        </LineChart>
      </ResponsiveContainer>
    </AccessibleChart>
  );
}

function buildSummary(data: RpPoint[], t: (key: string) => string): string {
  if (data.length === 0) return t('analytics.empty.noData');
  const latest = data[data.length - 1];
  const first = data[0];
  if (!latest || !first) return t('analytics.empty.noData');
  const direction =
    latest.rpAfter > first.rpAfter
      ? t('analytics.trend.up')
      : latest.rpAfter < first.rpAfter
        ? t('analytics.trend.down')
        : t('analytics.trend.flat');
  const tierName = t(TIER_MAP[latest.tierAfter].nameKey);
  return `${t('analytics.rp.summaryLatest')} ${formatInt(latest.rpAfter)} (${tierName}). ${direction}`;
}
