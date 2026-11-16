import { expect, test } from '@playwright/test';
import { court, onboard } from './helpers';

/**
 * Americano with a target: every round exists from the start, and the padel score sheet saves on
 * one tap (no confirm). Stopping early drops the rounds nobody played.
 */
test('8-round Americano: rounds pre-built, one-tap padel score, unplayed rounds dropped at finish', async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);

  await page.getByRole('button', { name: 'Mulai Sesi' }).click();
  await page.getByRole('button', { name: 'Padel' }).click();
  await page.getByRole('button', { name: 'Pilih semua' }).click();
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.getByRole('button', { name: /^2 Jam/ }).click(); // courts step: ~8 rounds
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.getByRole('button', { name: 'Mulai Sesi' }).click(); // format step: Americano is the default
  await expect(page).toHaveURL(/\/session\/[^/]+\/courts/);

  // Rounds 1..8 are there before anything was played, and each one already has its line-up.
  const strip = page.getByRole('navigation', { name: 'Pilih ronde' });
  await expect(strip.getByRole('button')).toHaveCount(8);
  await strip.getByRole('button', { name: 'Ronde 8', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ronde 8', exact: true })).toBeVisible();
  await expect(page.locator('article')).toHaveCount(2);
  await page.getByRole('button', { name: 'Ke Ronde 1' }).click();
  await expect(page.getByRole('heading', { name: 'Ronde 1', exact: true })).toBeVisible();

  // One tap on a number: saved, match completed, sheet closed. No confirm step.
  for (const i of [0, 1]) {
    await court(page, i).getByRole('button', { name: /^Buka papan skor/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /jadi 15$/ }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(court(page, i)).toHaveAttribute('aria-label', /Selesai$/);
    await expect(court(page, i).getByRole('button', { name: /sekarang 15$/ })).toBeVisible();
    await expect(court(page, i).getByRole('button', { name: /sekarang 6$/ })).toBeVisible();
  }

  // Round 1 done: the strip marks it, the bottom button moves on to round 2.
  await expect(strip.getByRole('button', { name: 'Ronde 1, selesai' })).toBeVisible();
  await page.getByRole('button', { name: 'Ke Ronde 2' }).click();
  await expect(page.getByRole('heading', { name: 'Ronde 2', exact: true })).toBeVisible();

  // Stop after one round: rounds 2..8 were never started and are dropped, so finishing is allowed.
  await page.getByRole('button', { name: 'Akhiri' }).click();
  await expect(page).toHaveURL(/\/finish$/);
  await expect(page.getByText('1 ronde,', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Selesaikan sesi' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Selesaikan sesi' }).click();
  // Finishing reads every player's previous stats from the server first: 0.2 s on Chromium, 5-13 s on
  // WebKit against the emulator (docs/progress.md, open question 16).
  await expect(page.getByRole('heading', { name: 'Sesi selesai' })).toBeVisible({ timeout: 30_000 });
});
