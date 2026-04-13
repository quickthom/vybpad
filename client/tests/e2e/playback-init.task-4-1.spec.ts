/*
 * QA COVERAGE PLAN — 4.1 (Playwright)
 *
 * Mandatory flows from brief:
 * - Open app → explicit user gesture → transport / audio readiness (no auto-start before gesture)
 * - Refresh / reopen: audio does not auto-init until gesture again
 * - Repeated play clicks while initializing: no double-start or unhandled page errors
 *
 * Selectors follow TASK-4.1 `TransportControls` (accessible names + sr-only readiness copy):
 * - First Play: role=button name "Start audio and play"
 * - Ready: text "Playback audio ready" (visually hidden, present in a11y tree)
 */

import { expect, test } from '@playwright/test';

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

test.describe('TASK 4.1 — playback init + gesture', () => {
  test.describe.configure({ mode: 'serial' });

  test('opens editor, stays pre-ready until gesture, then reaches ready after explicit play', async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-play-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E Play ${suffix}`;

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(displayName);
    await page.locator('#register-password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.goto('/editor');
    await expect(page.getByRole('application', { name: /Song editor/i })).toBeVisible({ timeout: 30_000 });

    await expect(page.getByText('Playback audio ready', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Start audio and play' }).click();

    await expect(page.getByText('Playback audio ready', { exact: true })).toBeAttached({ timeout: 30_000 });
  });

  test('after reload, audio does not auto-init until the user gestures again', async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-play-r-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E Play R ${suffix}`;

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(displayName);
    await page.locator('#register-password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.goto('/editor');
    await expect(page.getByRole('application', { name: /Song editor/i })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Start audio and play' }).click();
    await expect(page.getByText('Playback audio ready', { exact: true })).toBeAttached({ timeout: 30_000 });

    await page.reload();
    await expect(page.getByRole('application', { name: /Song editor/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Playback audio ready', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Start audio and play' }).click();
    await expect(page.getByText('Playback audio ready', { exact: true })).toBeAttached({ timeout: 30_000 });
  });

  test('rapid play clicks do not surface unhandled page errors and settle to a single ready transport', async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-play-m-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E Play M ${suffix}`;

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(displayName);
    await page.locator('#register-password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.goto('/editor');
    await expect(page.getByRole('application', { name: /Song editor/i })).toBeVisible({ timeout: 30_000 });

    const start = page.getByRole('button', { name: 'Start audio and play' });
    await start.click({ clickCount: 5, delay: 0 });

    await expect(page.getByText('Playback audio ready', { exact: true })).toBeAttached({ timeout: 30_000 });

    expect(pageErrors, 'no unhandled errors from rapid play during init').toEqual([]);
  });
});
