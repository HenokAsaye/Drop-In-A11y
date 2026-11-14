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
  test.fixme('downloaded lesson works after going offline', async () => {});
});
