import { expect, test } from '@playwright/test';
import { court, emulatorDocs, onboard, overflowsHorizontally, playMatch, resetEmulators, startBadmintonSession, tapPlus } from './helpers';

test.describe('golden path (host)', () => {
  test('onboarding -> roster -> session -> scoring -> finish -> bill -> image export', async ({ page }) => {
    test.setTimeout(180_000);
    await resetEmulators();
    await onboard(page);

    // Roster shows the 9 pasted players
    await page.getByRole('link', { name: 'Pemain', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Rizky' })).toBeVisible();
    await expect(page.locator('main ul > li')).toHaveCount(9);
    await page.getByRole('link', { name: 'Beranda' }).click();

    await startBadmintonSession(page);

    // Round 1: two courts, one player resting
    await expect(page.locator('article')).toHaveCount(2);
    await expect(page.getByText('Istirahat').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Ronde Berikutnya|Semua pertandingan harus selesai dulu/ })).toBeDisabled();

    await playMatch(page, 0, 10);
    await playMatch(page, 1, 15);

    // Scores survive a reload (Zustand + localStorage is the live source of truth)
    await page.reload();
    await expect(page.locator('article')).toHaveCount(2);
    await expect(court(page, 0).getByText('Selesai').first()).toBeVisible();

    // Next round unlocks and generates
    await page.getByRole('button', { name: 'Ronde Berikutnya' }).click();
    await expect(page.getByRole('heading', { name: 'Ronde 2', exact: true })).toBeVisible();

    // Round navigation: open round 1 again (still correctable), then return to the live round
    await page.getByRole('button', { name: 'Ronde 1, selesai' }).click();
    await expect(page.getByRole('heading', { name: 'Ronde 1', exact: true })).toBeVisible();
    await expect(court(page, 0).getByRole('button', { name: 'Buka Ulang' })).toBeVisible();
    await page.getByRole('button', { name: 'Ke Ronde 2' }).click();
    await expect(page.getByRole('heading', { name: 'Ronde 2', exact: true })).toBeVisible();

    await playMatch(page, 0, 12);
    await playMatch(page, 1, 8);

    // Standings reflect the results
    await page.getByRole('link', { name: 'Klasemen' }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(9);

    // Finish
    await page.getByRole('button', { name: 'Alat sesi' }).click();
    await page.getByRole('button', { name: 'Selesaikan sesi' }).click();
    await expect(page).toHaveURL(/\/finish$/);
    await page.getByRole('button', { name: 'Selesaikan sesi' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Selesaikan sesi' }).click();
    await expect(page.getByRole('heading', { name: 'Sesi selesai' })).toBeVisible();
    await expect(page.getByRole('list', { name: /Peringkat 1/ }).or(page.getByLabel('Peringkat 1'))).toBeVisible();

    // Bill: court fee split evenly across 9
    await page.getByRole('button', { name: 'Lanjut ke Tagihan' }).click();
    await page.getByRole('button', { name: 'Tambah item' }).click();
    await page.getByRole('button', { name: 'Sewa Lapangan' }).click();
    await page.getByLabel('Harga satuan').fill('450000');
    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await expect(page.getByText('Rp 450.000').first()).toBeVisible();
    await page.getByRole('heading', { name: 'Rincian Pembayaran' }).waitFor();
    await expect(page.getByText('Rp 50.000')).toHaveCount(9);

    // Everything really replicated to Firestore (local-first must not hide a failed write).
    await expect.poll(async () => (await emulatorDocs('hosts')).length, { timeout: 20_000 }).toBe(1);
    const hostId = (await emulatorDocs('hosts'))[0]?.name.split('/').pop() ?? '';
    await expect.poll(async () => (await emulatorDocs(`hosts/${hostId}/roster_players`)).length, { timeout: 20_000 }).toBe(9);
    const sessions = await emulatorDocs('sessions');
    expect(sessions).toHaveLength(1);
    const sid = sessions[0]?.name.split('/').pop() ?? '';
    await expect.poll(async () => (await emulatorDocs(`sessions/${sid}/rounds`)).length, { timeout: 20_000 }).toBe(2);
    await expect.poll(async () => (await emulatorDocs(`sessions/${sid}/bill`)).length, { timeout: 20_000 }).toBe(1);
    // Every one of the 9 players gets exactly one session_results doc once the session is committed.
    const playerIds = (await emulatorDocs(`hosts/${hostId}/roster_players`)).map((d) => d.name.split('/').pop() ?? '');
    await expect
      .poll(
        async () => {
          const counts = await Promise.all(playerIds.map(async (id) => (await emulatorDocs(`hosts/${hostId}/roster_players/${id}/session_results`)).length));
          return counts.reduce((a, b) => a + b, 0);
        },
        { timeout: 20_000 },
      )
      .toBe(9);

    // Image export: no native share in automation => falls back to a PNG download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Simpan sebagai Gambar' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });

  test('no horizontal overflow at 360px on the main screens', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await onboard(page);
    expect(await overflowsHorizontally(page)).toBe(false);
    for (const name of ['Pemain', 'Riwayat', 'Atur', 'Beranda']) {
      const tab = page.getByRole('link', { name, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-current', 'page'); // Firestore listeners keep the network busy forever
      await expect(page.getByRole('main')).toBeVisible();
      expect(await overflowsHorizontally(page), name).toBe(false);
    }
    await startBadmintonSession(page);
    await tapPlus(page, 0, 0, 3);
    expect(await overflowsHorizontally(page)).toBe(false);
  });
});
