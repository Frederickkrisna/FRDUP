// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import { LeaderboardCard } from './LeaderboardCard';
import { TierUpCard } from './TierUpCard';
import { demoLeaderboard, demoTierUp } from './demoData';
import type { CardFormat, CardTemplateId } from './types';

const TEMPLATES: CardTemplateId[] = ['court', 'night', 'paper'];
const FORMATS: CardFormat[] = ['feed', 'story'];
const COUNTS = [0, 1, 2, 3, 9, 25];

function markup(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, node));
}

describe('LeaderboardCard smoke render', () => {
  for (const template of TEMPLATES) {
    for (const format of FORMATS) {
      for (const count of COUNTS) {
        it(`renders ${template}/${format} with ${count} entries`, () => {
          const data = demoLeaderboard(count, count % 2 === 0 ? 'session' : 'alltime');
          let html = '';
          expect(() => {
            html = markup(createElement(LeaderboardCard, { data, template, format }));
          }).not.toThrow();
          expect(html.length).toBeGreaterThan(0);
          // The sport name and brand caption must always appear on the card.
          expect(html).toContain(data.sportName);
          expect(html).toContain(data.captions.brand);
        });
      }
    }
  }

  it('shows the overflow line for a large roster', () => {
    const data = demoLeaderboard(25, 'session');
    const html = markup(createElement(LeaderboardCard, { data, template: 'court', format: 'feed' }));
    // 25 - 3 podium - 7 rows (court/feed cap) = 15 remaining.
    expect(html).toContain('15');
  });

  it('renders a graceful empty state with zero entries', () => {
    const data = demoLeaderboard(0, 'session');
    const html = markup(createElement(LeaderboardCard, { data, template: 'paper', format: 'story' }));
    expect(html).toContain(data.sportName);
  });
});

describe('TierUpCard smoke render', () => {
  for (const template of TEMPLATES) {
    for (const format of FORMATS) {
      it(`renders tier-up ${template}/${format}`, () => {
        const data = demoTierUp();
        let html = '';
        expect(() => {
          html = markup(createElement(TierUpCard, { data, template, format }));
        }).not.toThrow();
        expect(html).toContain(data.sportName);
        expect(html).toContain(data.captions.brand);
        expect(html).toContain(data.tierName);
      });
    }
  }
});
