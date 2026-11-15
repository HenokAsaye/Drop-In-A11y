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

  test('lesson notes HTML passes axe when opened from the player', async ({ page }) => {
    const lesson = {
      id: 'networking-101',
      title: 'Introduction to Computer Networking',
      description: 'Learn the fundamentals of computer networking.',
      language: 'en',
      media: {
        video: 'https://media.example/video.mp4',
        audio: null,
        signLanguage: null,
        audioDescription: null,
        poster: null,
      },
      captions: [],
      transcripts: [],
      documents: [
        {
          title: 'Networking Notes',
          language: 'en',
          html: '/documents/networking-101-notes.html',
          pdf: '/documents/networking-101-notes.pdf',
        },
      ],
    };

    await page.route(/\/api\/v1\/lessons\/networking-101$/, (route) =>
      route.fulfill({ json: lesson }),
    );
    await page.route(/\/api\/v1\/lessons\/networking-101\/transcript/, (route) =>
      route.fulfill({ json: { language: 'en', segments: [] } }),
    );

    await page.goto('/');
    await page.getByRole('link', { name: 'Networking Notes, HTML' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Introduction to Computer Networking' }),
    ).toBeVisible();
    await expect(page.getByRole('img', { name: /computer connected to a switch/ })).toBeVisible();

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
  test('career cards remain usable at 640px and 320px layout widths', async ({ page }) => {
    const job = {
      id: 1,
      title: 'Network Support Technician for campus learning spaces and remote classrooms',
      organization: 'Savanna Learning',
      description:
        'Help learners connect to campus networks, set up classroom equipment, and explain connection problems in plain language during in-person and remote support appointments.',
      location: 'Addis Ababa',
      applicationUrl: 'https://jobs.example/network-support-technician',
      audioSummaryUrl: 'https://media.example/network-support-technician-summary.mp3',
      accommodations:
        'Interviews can include sign language interpretation, extra time, and a written alternative to a spoken task.',
      certificateVerificationUrl: null,
    };

    await page.route(
      (url) => url.pathname === '/api/v1/careers',
      async (route) => {
        if (route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [job], total: 1, limit: 20, offset: 0 }),
        });
      },
    );

    // 640px is the CSS layout width of a 1280px screen at 200% zoom. The viewport is resized;
    // the browser zoom setting is left unchanged.
    const card = page.locator('savanna-job-card');
    const title = card.getByRole('heading', { name: job.title });
    const apply = card.getByRole('link', {
      name: `Apply for ${job.title} at ${job.organization}`,
    });

    async function expectUsable(): Promise<void> {
      await expect(card).toBeVisible();
      await expect(title).toBeVisible();
      await expect(apply).toBeVisible();
      expect(await card.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
        false,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
      ).toBe(false);
    }

    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto('/');
    await expectUsable();

    await page.setViewportSize({ width: 320, height: 900 });
    await expectUsable();
  });
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
