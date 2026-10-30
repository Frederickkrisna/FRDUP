import { expect, test } from '@playwright/test';
import { court, onboard, startBadmintonSession, tapPlus } from './helpers';

// Service-worker offline behaviour is verified on Chromium. WebKit's offline emulation + SW is
// covered by the manual iPhone checklist in docs/progress.md.
test.describe('offline-first', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'chromium only');

  test('scoring continues offline, survives a reload, and syncs after reconnecting', async ({ page, context }) => {
    await onboard(page);
    await startBadmintonSession(page);

    // The service worker must have precached the shell before we cut the network.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.waitForTimeout(1500);

    await context.setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible();

    await tapPlus(page, 0, 0, 5);
    await tapPlus(page, 0, 1, 3);
    await expect(court(page, 0).getByText('5').first()).toBeVisible();

    await page.reload(); // served by the service worker, state restored from localStorage
    await expect(page.locator('article')).toHaveCount(2);
    await expect(court(page, 0).getByRole('button', { name: /Buka papan skor.*sekarang 5/ })).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByRole('status').filter({ hasText: 'Tersinkron' })).toBeVisible({ timeout: 30_000 });
  });
});
