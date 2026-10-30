import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import type { PlayerSessionResultDoc } from '@/types/player';
import type { RpEventDoc } from '@/types/stats';
import type { AnalyticsWindow } from '@/core/analytics/types';
import { Skeleton } from '@/components/Skeleton';

/*
 * This module is the ONLY place that imports the chart modules, and it does so with
 * dynamic import() so recharts is code-split out of the initial bundle. Each chart is a
 * named export, so we map it onto `default` for React.lazy.
 */
const WinRateChartLazy = lazy(() =>
  import('./WinRateChart').then((m) => ({ default: m.WinRateChart as ComponentType<WinRateProps> })),
);
const PointsChartLazy = lazy(() =>
  import('./PointsChart').then((m) => ({ default: m.PointsChart as ComponentType<PointsProps> })),
);
const RpHistoryChartLazy = lazy(() =>
  import('./RpHistoryChart').then((m) => ({ default: m.RpHistoryChart as ComponentType<RpProps> })),
);

type WinRateProps = { results: PlayerSessionResultDoc[]; window: AnalyticsWindow; height?: number };
type PointsProps = { results: PlayerSessionResultDoc[]; window: AnalyticsWindow; height?: number };
type RpProps = { events: RpEventDoc[]; height?: number };

/**
 * Defers mounting its children until the browser is idle, so the surrounding screen
 * paints first and the (heavy) recharts chunk loads off the critical path. Falls back
 * to setTimeout(…, 0) where requestIdleCallback is unavailable (Safari/jsdom).
 */
function useIdleReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ric = window.requestIdleCallback;
    if (typeof ric === 'function') {
      const handle = ric(() => setReady(true));
      return () => window.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return ready;
}

function ChartSkeleton({ height }: { height: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height }} />;
}

/** Idle-mounted, Suspense-wrapped win-rate chart. */
export function LazyWinRateChart(props: WinRateProps) {
  const ready = useIdleReady();
  const height = props.height ?? 200;
  if (!ready) return <ChartSkeleton height={height} />;
  return (
    <Suspense fallback={<ChartSkeleton height={height} />}>
      <WinRateChartLazy {...props} />
    </Suspense>
  );
}

/** Idle-mounted, Suspense-wrapped points chart. */
export function LazyPointsChart(props: PointsProps) {
  const ready = useIdleReady();
  const height = props.height ?? 200;
  if (!ready) return <ChartSkeleton height={height} />;
  return (
    <Suspense fallback={<ChartSkeleton height={height} />}>
      <PointsChartLazy {...props} />
    </Suspense>
  );
}

/** Idle-mounted, Suspense-wrapped RP history chart. */
export function LazyRpHistoryChart(props: RpProps) {
  const ready = useIdleReady();
  const height = props.height ?? 220;
  if (!ready) return <ChartSkeleton height={height} />;
  return (
    <Suspense fallback={<ChartSkeleton height={height} />}>
      <RpHistoryChartLazy {...props} />
    </Suspense>
  );
}
