// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n';
import { PlayerAnalytics } from '../PlayerAnalytics';
import { demoStats } from '../demoData';

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(<I18nextProvider i18n={i18n}>{node}</I18nextProvider>);
}

describe('PlayerAnalytics (SSR smoke)', () => {
  beforeAll(async () => {
    if (!i18n.isInitialized) {
      await new Promise<void>((resolve) => i18n.on('initialized', () => resolve()));
    }
  });

  it('renders the loading skeleton', () => {
    const html = render(
      <PlayerAnalytics stats={null} results={[]} rpEvents={[]} loading />,
    );
    expect(html).toContain('aria-busy="true"');
  });

  it('renders the error state with a retry affordance', () => {
    const html = render(
      <PlayerAnalytics stats={null} results={[]} rpEvents={[]} error onRetry={() => {}} />,
    );
    // The retry button copy comes from common.retry.
    expect(html).toContain(i18n.t('common.retry'));
  });

  it('renders the empty state below the data threshold', () => {
    const html = render(
      <PlayerAnalytics stats={demoStats()} results={[]} rpEvents={[]} />,
    );
    expect(html).toContain(i18n.t('analytics.empty.body'));
  });

  it('renders the StatTile grid labels', () => {
    const html = render(
      <PlayerAnalytics stats={demoStats()} results={[]} rpEvents={[]} />,
    );
    expect(html).toContain(i18n.t('analytics.stat.matches'));
    expect(html).toContain(i18n.t('analytics.stat.winRate'));
  });
});
