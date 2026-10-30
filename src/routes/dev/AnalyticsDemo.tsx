import { PlayerAnalytics } from '@/features/analytics/PlayerAnalytics';
import { demoRpEvents, demoResults, demoStats } from '@/features/analytics/demoData';

/** DEV ONLY: renders the profile analytics with demo data for visual checks. */
export function AnalyticsDemo() {
  return (
    <div className="mx-auto max-w-[560px] p-4">
      <PlayerAnalytics stats={demoStats()} results={demoResults(20)} rpEvents={demoRpEvents(20)} />
    </div>
  );
}
