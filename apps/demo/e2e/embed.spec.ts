import { expect, test } from '@playwright/test';

import { LESSON, mockLesson } from './fixtures';

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

  test('plugin loads lesson networking-101 from the API', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => requested.push(new URL(request.url()).pathname));
    await mockLesson(page);

    await page.goto('/');

    const video = page.getByLabel(LESSON.title, { exact: true });
    await expect(video).toHaveAttribute('src', LESSON.media.video);
    await expect(page.locator('savanna-player')).toHaveAttribute('lesson-id', 'networking-101');
    expect(requested).toContain('/api/v1/lessons/networking-101');
  });
  test('video playback works', async ({ page }) => {
    await mockLesson(page);
    await page.goto('/');

    const video = page.locator('savanna-player video.lesson-video');
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState))
      .toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    expect(await video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
  });

  test('switching between English and Amharic captions', async ({ page }) => {
    await page.goto('/');
    const language = page.getByRole('combobox', { name: 'Language' });
    await expect(language).toBeVisible();
    await expect(language).toHaveValue('en');

    await language.selectOption('am');
    await expect(language).toHaveValue('am');

    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('am');
  });

  test('caption size and colors can be adjusted', async ({ page }) => {
    await page.goto('/');
    const size = page.getByRole('slider', { name: 'Caption size' });
    const background = page.getByLabel('Background color');
    await expect(size).toBeVisible();

    await size.fill('1.5');
    await background.fill('#00aa00');
    await expect(size).toHaveValue('1.5');
    await expect(background).toHaveValue('#00aa00');

    await page.reload();
    await expect(page.getByRole('slider', { name: 'Caption size' })).toHaveValue('1.5');
    await expect(page.getByLabel('Background color')).toHaveValue('#00aa00');
  });

  test.fixme('sign-language window can be shown, moved and resized', async () => {});
  test('clicking a transcript sentence seeks the video', async ({ page }) => {
    await mockLesson(page);
    await page.goto('/');

    const video = page.locator('savanna-player video.lesson-video');
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState))
      .toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Every device has an address.', exact: true }).click();
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeCloseTo(4, 0);
  });
});
