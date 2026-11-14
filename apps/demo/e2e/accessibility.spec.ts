import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.describe('automated accessibility (spec 11.2)', () => {
  test('axe-core reports zero critical and serious violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(customElements.get('savanna-player')));

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );

    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('skip link is the first focusable element and is visible on focus', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const skipLink = page.getByRole('link', { name: 'Skip to lesson' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();
  });

  test.fixme('every player control is reachable and operable by keyboard alone', async () => {});
  test.fixme('there are no keyboard traps in the player or sign-language window', async () => {});
  test.fixme('content has no horizontal scrolling at 200% zoom (1280px at 2x)', async () => {});
  test.fixme('career cards remain usable at 200% zoom', async () => {});
  test('downloaded lesson works after going offline', async ({ page, context }) => {
    const lesson = {
      id: 'networking-101',
      title: 'Networking 101',
      description: 'Learn networking.',
      language: 'en',
      media: {
        video: '/test-media/lesson.mp4',
        audio: null,
        signLanguage: null,
        audioDescription: null,
        poster: null,
      },
      captions: [],
      transcripts: [],
      documents: [],
    };
    const audioUrl = '/test-media/networking-101.mp3';
    await page.route(/\/api\/v1\/lessons\/networking-101$/, (route) =>
      route.fulfill({ json: lesson }),
    );
    await page.route(/\/api\/v1\/lessons\/networking-101\/offline$/, (route) =>
      route.fulfill({
        json: {
          lessonId: 'networking-101',
          version: 'v1',
          resources: [{ type: 'audio', url: `http://localhost:4173${audioUrl}` }],
        },
      }),
    );
    await page.route('**/test-media/networking-101.mp3', (route) =>
      route.fulfill({ body: 'audio-bytes', contentType: 'audio/mpeg' }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Download audio only' }).click();
    await expect(page.getByText('Downloaded for offline use')).toBeVisible();

    // Remove the fake network source so only the saved copy can answer, then disconnect.
    await page.unroute('**/test-media/networking-101.mp3');
    await context.setOffline(true);

    const saved = await page.evaluate((url) => fetch(url).then((r) => r.text()), audioUrl);
    expect(saved).toBe('audio-bytes');
    const notSaved = await page.evaluate(
      (url) =>
        fetch(url).then(
          () => 'loaded',
          () => 'failed',
        ),
      '/test-media/never-downloaded.mp3',
    );
    expect(notSaved).toBe('failed');
  });
});
