import { expect, test } from '@playwright/test';
import { court, onboard, startBadmintonSession, tapPlus } from './helpers';

test('co-host joins by link, claims a court, and scores; host sees it and both can score different courts', async ({ browser }) => {
  const opts = test.info().project.use;
  const hostCtx = await browser.newContext(opts);
  const coCtx = await browser.newContext(opts);
  const host = await hostCtx.newPage();
  const co = await coCtx.newPage();

  await onboard(host);
  await startBadmintonSession(host);

  // Host opens the join-code screen and reads the live code.
  await host.getByRole('button', { name: 'Kode Gabung' }).click();
  const codeEl = host.locator('p.select-all');
  await expect(codeEl).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/, { timeout: 20_000 });
  const code = (await codeEl.textContent()) ?? '';
  await expect(host.getByRole('img', { name: new RegExp(code) })).toBeVisible(); // QR
  await host.goBack();

  // Co-host opens the shared link: resolves, registers, lands on the courts screen.
  await co.goto(`/join/${code}`);
  await expect(co).toHaveURL(/\/session\/[^/]+\/courts/, { timeout: 30_000 });
  await expect(co.locator('article')).toHaveCount(2);

  // Unclaimed courts are locked for a co-host.
  await expect(co.getByText('Klaim lapangan dulu').first()).toBeVisible();
  await co.getByRole('button', { name: 'Lapangan 1' }).click();
  await expect(co.getByText('Klaim lapangan dulu')).toHaveCount(1); // court 2 still locked

  // Co-host scores court 1; host scores court 2 at the same time.
  await tapPlus(co, 0, 0, 4);
  await tapPlus(host, 1, 1, 3);

  // Both phones converge on both scores (field-level merge, nothing lost).
  await expect(court(host, 0).getByRole('button', { name: /Buka papan skor.*sekarang 4/ })).toBeVisible({ timeout: 30_000 });
  await expect(court(co, 1).getByRole('button', { name: /Buka papan skor.*sekarang 3/ })).toBeVisible({ timeout: 30_000 });
  await expect(court(host, 1).getByRole('button', { name: /Buka papan skor.*sekarang 3/ })).toBeVisible();
  await expect(court(co, 0).getByRole('button', { name: /Buka papan skor.*sekarang 4/ })).toBeVisible();

  // The host sees the connected device.
  await host.getByRole('button', { name: 'Kode Gabung' }).click();
  await expect(host.getByText('HP Android').or(host.getByText('iPhone'))).toBeVisible({ timeout: 15_000 });

  await hostCtx.close();
  await coCtx.close();
});

test('an invalid code shows a friendly error, not a crash', async ({ page }) => {
  await page.goto('/join/ABCDE2');
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/join\//);
});
