import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { onboard, startBadmintonSession, tapPlus } from './helpers';

/** Entry animations are mid-flight otherwise and axe samples half-transparent text. */
async function settle(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => (a.effect?.getComputedTiming().iterations ?? 1) !== Infinity).map((a) => a.finished.catch(() => undefined))));
}

async function audit(page: Page, label: string) {
  await settle(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(blocking.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.help} :: ${v.nodes.map((n) => `${n.target.join(' ')} ${(n.any[0]?.message ?? '').slice(0, 140)}`).join(' || ')}`)).toEqual([]);
}

test('accessibility: no serious/critical WCAG A/AA violations on the core screens', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);
  await audit(page, 'onboarding');

  await onboard(page);
  await audit(page, 'home');

  await page.getByRole('link', { name: 'Pemain', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Rizky' })).toBeVisible();
  await audit(page, 'roster');

  await page.getByRole('link', { name: 'Beranda' }).click();
  await startBadmintonSession(page);
  await tapPlus(page, 0, 0, 2);
  await audit(page, 'courts');

  await page.getByRole('link', { name: 'Klasemen' }).click();
  await audit(page, 'standings');
});

test('reduced motion: no looping animation is left running', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await onboard(page);
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getComputedTiming().iterations ?? 1) === Infinity).length);
  expect(running).toBe(0);
  await ctx.close();
});
