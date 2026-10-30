import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { CARD_SIZE, type CardFormat, type CardTemplateId } from '../src/features/export/types';

// Dev server (5174) exposes /__dev/export. This is the WebKit/Chromium check of the image pipeline.
test.use({ baseURL: 'http://localhost:5174' });

const TEMPLATES: CardTemplateId[] = ['court', 'night', 'paper'];
const FORMATS: CardFormat[] = ['feed', 'story'];

async function renderOnce(page: Page, qs: string, testInfo: TestInfo, tag: string) {
  await page.goto(`/__dev/export?${qs}`);
  await page.getByTestId('render').click();
  const result = page.getByTestId('result');
  await expect(result).toBeVisible({ timeout: 45_000 });
  const bytes = Number(await result.getAttribute('data-bytes'));
  const width = Number(await result.getAttribute('data-width'));
  const height = Number(await result.getAttribute('data-height'));
  await testInfo.attach(`${tag}.png`, { body: await result.locator('img').screenshot(), contentType: 'image/png' });
  return { bytes, width, height };
}

test.describe('Instagram export renders identically in size on Chromium and WebKit', () => {
  for (const template of TEMPLATES) {
    for (const format of FORMATS) {
      test(`${template} ${format}: exact size and non-blank`, async ({ page }, testInfo) => {
        const { bytes, width, height } = await renderOnce(page, `template=${template}&format=${format}&count=9`, testInfo, `${template}-${format}`);
        expect(width).toBe(CARD_SIZE[format].width);
        expect(height).toBe(CARD_SIZE[format].height);
        expect(bytes).toBeGreaterThan(20_000); // blank first-render bug => a tiny file
      });
    }
  }

  test('first render after a cold load is not blank (Safari warm-up)', async ({ page }, testInfo) => {
    const { bytes } = await renderOnce(page, 'template=court&format=feed&count=25', testInfo, 'cold-25');
    expect(bytes).toBeGreaterThan(20_000);
  });

  test('edge counts render: 0, 1, 2 entries and the tier-up card', async ({ page }, testInfo) => {
    for (const count of [0, 1, 2]) {
      const r = await renderOnce(page, `template=night&format=story&count=${count}`, testInfo, `night-${count}`);
      expect(r.bytes).toBeGreaterThan(8_000);
    }
    const t = await renderOnce(page, 'kind=tierup&template=court&format=story', testInfo, 'tierup');
    expect(t.bytes).toBeGreaterThan(20_000);
  });
});
