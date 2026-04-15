/**
 * F-07 P0 — UX §4 minimum 1024px width. Requires API + Postgres (same as persistence E2E).
 */

import { expect, test } from '@playwright/test';

import { waitForEditorRouteReady } from './helpers/editorReady';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';

test.describe('F-07 — minimum viewport width (§4)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('login route shows blocking copy below 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 720 });
    await page.goto('/login');
    await expect(page.getByText(/vYbpad needs a display at least 1024px wide/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('editor shows blocking copy after resize below 1024px (authenticated)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const email = `e2e-viewport-${suffix}@vybpad-e2e.test`;

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(`Viewport ${suffix}`);
    await page.locator('#register-password').fill('E2ETestPass-123');
    await submitRegisterFormAndExpectProjects(page);

    await page.locator('#new-project-name').fill(`Proj ${suffix}`);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i);

    await waitForEditorRouteReady(page);

    await page.setViewportSize({ width: 800, height: 720 });
    await expect(page.getByText(/vYbpad needs a display at least 1024px wide/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
