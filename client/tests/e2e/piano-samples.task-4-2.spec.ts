/*
 * QA COVERAGE PLAN — 4.2 (Playwright)
 *
 * Criterion 5: E2E critical path + edge cases
 *   Scenario A: login → editor → Play → loading (piano/samples) → ready
 *   Scenario B: reload → Play → no stuck initializing
 *   Scenario C: rapid Play during load → no pageerror / console error → eventual ready
 *   Scenario D: blocked sample fetch → safe alert copy, no crash
 *
 * CI: `npm run test:e2e` from repo root (starts devstack unless PLAYWRIGHT_SKIP_WEBSERVER=1).
 * Local: ensure client+API running on PLAYWRIGHT_BASE_URL or use default 127.0.0.1:5173.
 */

import { expect, test } from '@playwright/test';

import { getTransportPlayButton, getTransportToolbar } from './helpers/transport';

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function registerAndOpenEditor(page: import('@playwright/test').Page): Promise<void> {
  const suffix = uniqueSuffix();
  const email = `e2e-piano-${suffix}@vybpad-e2e.test`;
  const password = 'E2ETestPass-123';
  const displayName = `E2E Piano ${suffix}`;
  const projectName = `E2E Piano Project ${suffix}`;

  await page.goto('/register');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-display-name').fill(displayName);
  await page.locator('#register-password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/projects$/);

  await page.locator('#new-project-name').fill(projectName);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i);

  await expect(page.getByText('Loading project…')).toBeHidden({ timeout: 30_000 });
}

test.describe('TASK-4.2 — piano sample loading (E2E)', () => {
  test.describe.configure({ mode: 'serial' });

  test('Scenario A — Play shows piano-oriented loading then reaches audio-ready', async ({ page }) => {
    await page.route('**/samples/**', async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });

    await registerAndOpenEditor(page);

    const transport = getTransportToolbar(page);
    await expect(transport).toBeVisible();
    await expect(transport).toHaveAttribute('data-audio-ready', 'false');

    const playBtn = getTransportPlayButton(transport);
    await playBtn.click();

    await expect(transport.getByText(/piano|instrument samples|loading samples/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(transport).toHaveAttribute('data-audio-ready', 'true', { timeout: 45_000 });
  });

  test('Scenario B — after reload, Play reaches ready (not stuck initializing)', async ({ page }) => {
    await registerAndOpenEditor(page);

    const transport = getTransportToolbar(page);
    await getTransportPlayButton(transport).click();
    await expect(transport).toHaveAttribute('data-audio-ready', 'true', { timeout: 45_000 });

    await page.reload();
    await expect(page.getByText('Loading project…')).toBeHidden({ timeout: 30_000 });

    const transportAfter = getTransportToolbar(page);
    await expect(transportAfter).toHaveAttribute('data-audio-ready', 'false');
    await getTransportPlayButton(transportAfter).click();

    await expect(transportAfter).toHaveAttribute('data-audio-ready', 'true', { timeout: 45_000 });
  });

  test('Scenario C — rapid Play clicks during loading; no pageerror/console error; eventual ready', async ({
    page,
  }) => {
    await page.route('**/samples/**', async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      await route.continue();
    });

    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await registerAndOpenEditor(page);

    const transport = getTransportToolbar(page);
    const playBtn = getTransportPlayButton(transport);

    await playBtn.evaluate((el: HTMLButtonElement) => {
      for (let i = 0; i < 50; i += 1) {
        el.click();
      }
    });

    await expect(transport).toHaveAttribute('data-audio-ready', 'true', { timeout: 45_000 });

    expect(pageErrors, `pageerror: ${pageErrors.map((e) => e.message).join('; ')}`).toHaveLength(0);
    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join(' | ')}`,
    ).toHaveLength(0);
  });

  test('Scenario D — when sample URLs fail, user sees safe messaging (no crash)', async ({ page }) => {
    await page.route('**/samples/**', (route) => route.abort('failed'));

    await registerAndOpenEditor(page);

    const transport = getTransportToolbar(page);
    await getTransportPlayButton(transport).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('alert')).toContainText(/sample|connection|try again|audio/i);
  });
});
