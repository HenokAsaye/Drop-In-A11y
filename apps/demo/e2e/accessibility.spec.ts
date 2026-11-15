import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { mockLesson } from './fixtures';

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

  test('every player control is reachable and operable by keyboard alone', async ({ page }) => {
    await mockLesson(page);
    await page.goto('/');
    const video = page.locator('savanna-player video.lesson-video');
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState))
      .toBeGreaterThan(0);

    // Reach every control with Tab alone.
    for (const name of [
      'Play',
      'Seek',
      'Mute',
      'Volume',
      /Playback speed/,
      'Ethiopian Sign Language',
      'Keyboard shortcuts',
    ]) {
      await tabTo(page, name);
    }

    // Operate them with Space, Enter and the documented shortcuts.
    await tabTo(page, 'Play');
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeGreaterThan(0);

    await page.keyboard.press('m');
    await expect(page.getByRole('button', { name: 'Unmute', exact: true })).toBeVisible();

    await tabTo(page, 'Ethiopian Sign Language');
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('button', { name: 'Ethiopian Sign Language', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');

    await tabTo(page, 'Keyboard shortcuts');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Keyboard shortcuts' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  test('there are no keyboard traps in the player or sign-language window', async ({ page }) => {
    await mockLesson(page);
    await routeCareers(page);
    await page.goto('/');
    await expect(page.locator('savanna-job-card')).toHaveCount(1);

    await page.getByRole('button', { name: 'Ethiopian Sign Language', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Ethiopian Sign Language interpreter' }),
    ).toBeVisible();

    // Tab forward from the top of the page: focus must pass the player and sign window
    // and reach the career filters that follow them.
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const seen = new Set<string>();
    for (let i = 0; i < 80; i += 1) {
      await page.keyboard.press('Tab');
      seen.add(await describeFocus(page));
      if (
        await page
          .locator('#career-filter-location')
          .evaluate((el) => el === document.activeElement)
      ) {
        break;
      }
    }
    await expect(page.getByRole('combobox', { name: 'Location' })).toBeFocused();
    expect([...seen].some((item) => item.includes('Move sign language window'))).toBe(true);
    expect([...seen].some((item) => item.includes('Resize sign language window'))).toBe(true);

    // Shift+Tab must walk back out the same way.
    for (let i = 0; i < 80; i += 1) {
      await page.keyboard.press('Shift+Tab');
      if ((await describeFocus(page)).includes('Move sign language window')) break;
    }
    await expect(page.getByRole('button', { name: /Move sign language window/i })).toBeFocused();

    // Escape closes the window and returns focus to the page rather than trapping it.
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('region', { name: 'Ethiopian Sign Language interpreter' }),
    ).toBeHidden();
  });
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

  test('career list filters by location and accommodations from keyboard at 640px and 320px (Issue #42)', async ({
    page,
  }) => {
    const jobs = [
      {
        id: 1,
        title: 'Network Support Technician',
        organization: 'Savanna Learning',
        description: 'Help learners connect to campus networks.',
        location: 'Addis Ababa',
        applicationUrl: 'https://jobs.example/1',
        audioSummaryUrl: null,
        accommodations: 'Sign language interpretation available.',
        certificateVerificationUrl: null,
      },
      {
        id: 2,
        title: 'Accessibility Specialist',
        organization: 'Savanna Learning',
        description: 'Design accessible materials.',
        location: 'Hawassa',
        applicationUrl: 'https://jobs.example/2',
        audioSummaryUrl: null,
        accommodations: null,
        certificateVerificationUrl: null,
      },
      {
        id: 3,
        title: 'Remote Systems Admin',
        organization: 'Savanna Learning',
        description: 'Maintain cloud servers.',
        location: 'Addis Ababa',
        applicationUrl: 'https://jobs.example/3',
        audioSummaryUrl: null,
        accommodations: null,
        certificateVerificationUrl: null,
      },
    ];

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
          body: JSON.stringify({ items: jobs, total: 3, limit: 20, offset: 0 }),
        });
      },
    );

    async function checkFilterAtWidth(width: number): Promise<void> {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const cards = page.locator('savanna-job-card');
      await expect(cards).toHaveCount(3);

      const locationSelect = page.getByRole('combobox', { name: 'Location' });
      const accommodationsCheck = page.getByRole('checkbox', { name: /accommodations/i });
      const status = page.locator('#careers-status');

      await expect(locationSelect).toBeVisible();
      await expect(accommodationsCheck).toBeVisible();

      // Filter by location
      await locationSelect.focus();
      await locationSelect.selectOption('Hawassa');
      await expect(cards).toHaveCount(1);
      await expect(cards.first()).toContainText('Accessibility Specialist');

      // Filter by accommodations using keyboard: Hawassa job has none -> empty state
      await accommodationsCheck.focus();
      await page.keyboard.press('Space');
      await expect(cards).toHaveCount(0);
      await expect(status).toBeVisible();
      await expect(status).toContainText('No career opportunities match your filters.');

      // Toggle accommodations off with keyboard
      await page.keyboard.press('Space');
      await expect(cards).toHaveCount(1);

      // Select Addis Ababa (has 2 jobs, 1 with accommodations)
      await locationSelect.focus();
      await locationSelect.selectOption('Addis Ababa');
      await expect(cards).toHaveCount(2);

      // Toggle accommodations on
      await accommodationsCheck.focus();
      await page.keyboard.press('Space');
      await expect(cards).toHaveCount(1);
      await expect(cards.first()).toContainText('Network Support Technician');

      // Reset filters
      await locationSelect.selectOption('');
      await page.keyboard.press('Space');
      await expect(cards).toHaveCount(3);

      // Verify no horizontal overflow
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
      ).toBe(false);
    }

    await checkFilterAtWidth(640);
    await checkFilterAtWidth(320);
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

/** Name of the focused element, looking through shadow roots. */
async function describeFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    if (active === null) return '';
    return `${active.getAttribute('aria-label') ?? ''} ${active.textContent ?? ''}`.trim();
  });
}

/** Press Tab until the control with this name is focused; fail if focus never gets there. */
async function tabTo(page: Page, name: string | RegExp): Promise<void> {
  const matches = (text: string) =>
    typeof name === 'string' ? text.startsWith(name) : name.test(text);
  for (let i = 0; i < 60; i += 1) {
    if (matches(await describeFocus(page))) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab never reached a control named ${String(name)}`);
}

async function routeCareers(page: Page): Promise<void> {
  const job = {
    id: 1,
    title: 'Network Support Technician',
    organization: 'Savanna Learning',
    description: 'Help learners connect.',
    location: 'Addis Ababa',
    applicationUrl: 'https://jobs.example/1',
    audioSummaryUrl: null,
    accommodations: null,
    certificateVerificationUrl: null,
  };
  await page.route(
    (url) => url.pathname === '/api/v1/careers',
    (route) => route.fulfill({ json: { items: [job], total: 1, limit: 20, offset: 0 } }),
  );
}
