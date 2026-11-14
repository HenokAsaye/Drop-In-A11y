import { expect, test } from '@playwright/test';

test.describe('script-tag integration (spec 3, 11.1)', () => {
  test('host page loads the plugin with a plain script tag', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('script[src$="bridge-player.js"]')).toHaveCount(1);
    await expect
      .poll(() => page.evaluate(() => Boolean(customElements.get('savanna-player'))))
      .toBe(true);
  });

  test('player renders its labelled region inside the host page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('region', { name: 'Lesson player' })).toBeVisible();
  });

  test.fixme('plugin loads lesson networking-101 from the API', async () => {});
  test.fixme('video playback works', async () => {});
  test.fixme('switching between English and Amharic captions', async () => {});
  test.fixme('caption size and colors can be adjusted', async () => {});
  test.fixme('sign-language window can be shown, moved and resized', async () => {});
  test.fixme('clicking a transcript sentence seeks the video', async () => {});
});
