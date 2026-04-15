/**
 * F-07 P0 — UX §4 minimum 1024px width (auth/editor/editor gate covered in component tests;
 * this E2E asserts the blocking copy on a public route without DB).
 */

import { expect, test } from '@playwright/test';

test.describe('F-07 — minimum viewport width (§4)', () => {
  test('login route shows blocking copy below 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 720 });
    await page.goto('/login');
    await expect(page.getByText(/vYbpad needs a display at least 1024px wide/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
