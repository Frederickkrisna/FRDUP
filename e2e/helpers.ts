import { expect, type Locator, type Page } from '@playwright/test';

export const NAMES = ['Rizky', 'Sari', 'Budi', 'Dewi', 'Andi', 'Tono', 'Maya', 'Eko', 'Lina'];

/** Fresh browser context => fresh anonymous user. Walks the 3 onboarding steps. */
export async function onboard(page: Page, host = 'Frederick', names: string[] = NAMES) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel('Namamu').fill(host);
  await page.getByRole('button', { name: 'Mulai', exact: true }).click();
  await page.getByRole('button', { name: 'Badminton' }).click();
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.getByLabel('Daftar nama').fill(names.join('\n'));
  await expect(page.getByText(`${names.length} nama terdeteksi`)).toBeVisible();
  await page.getByRole('button', { name: 'Mulai Main' }).click();
  await expect(page).toHaveURL(/\/home$/);
}

export async function startBadmintonSession(page: Page) {
  await page.getByRole('button', { name: 'Mulai Sesi' }).click();
  await expect(page).toHaveURL(/\/session\/setup/);
  await page.getByRole('button', { name: 'Pilih semua' }).click();
  await expect(page.getByText('9 pemain dipilih')).toBeVisible();
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await expect(page.getByText('9 pemain, 2 lapangan → 8 main, 1 istirahat tiap ronde')).toBeVisible();
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.getByRole('button', { name: 'Mulai Sesi' }).click();
  await expect(page).toHaveURL(/\/session\/[^/]+\/courts/);
}

export function court(page: Page, index: number): Locator {
  return page.locator('article').nth(index);
}

/** Taps + on a court's team `team` (0|1) `times` times, via the inline 64px buttons. */
export async function tapPlus(page: Page, courtIndex: number, team: 0 | 1, times: number) {
  const btn = court(page, courtIndex).getByRole('button', { name: /^Tambah poin/ }).nth(team);
  await btn.click(); // one real click (visibility, hit-target, scroll-into-view)
  // The remaining taps skip per-click actionability polling, which makes 120+ taps/test take minutes on WebKit.
  for (let i = 1; i < times; i++) await btn.dispatchEvent('click');
}

/** Plays a decided badminton match (21-x) and presses Selesai. */
export async function playMatch(page: Page, courtIndex: number, loserPoints = 10) {
  await tapPlus(page, courtIndex, 0, 21);
  await tapPlus(page, courtIndex, 1, loserPoints);
  await court(page, courtIndex).getByRole('button', { name: 'Selesai' }).click();
  await expect(court(page, courtIndex).getByText('Selesai').first()).toBeVisible();
}

export async function overflowsHorizontally(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

/** Reads a collection straight from the Firestore emulator (admin bearer), to prove data really replicated. */
export async function emulatorDocs(path: string): Promise<Array<{ name: string; fields?: Record<string, unknown> }>> {
  const res = await fetch(`http://localhost:8080/v1/projects/demo-frdup/databases/(default)/documents/${path}`, { headers: { Authorization: 'Bearer owner' } });
  const body = (await res.json()) as { documents?: Array<{ name: string; fields?: Record<string, unknown> }> };
  return body.documents ?? [];
}
/** Wipes Firestore + Auth emulator state so assertions about "what is in the database" are exact. */
export async function resetEmulators(): Promise<void> {
  await fetch('http://localhost:8080/emulator/v1/projects/demo-frdup/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://localhost:9099/emulator/v1/projects/demo-frdup/accounts', { method: 'DELETE' });
}