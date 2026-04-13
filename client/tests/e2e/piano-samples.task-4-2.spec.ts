/*
 * QA COVERAGE PLAN — 4.2 (Playwright, remediation round 3 — transport lifecycle + shared helpers)
 *
 * Contracts: INTERFACES.md — TransportControls (initStatus via toolbar), PlaybackStore init lifecycle,
 *            AudioEngine.initialize + sample load → ready.
 *
 * Criterion — E2E piano sample loading
 *   Scenario A: login → editor → Play → loading (piano/samples) → ready
 *   Scenario B: reload → Play → ready (not stuck initializing) — robust toolbar assertions
 *   Scenario C: rapid Play during load → no pageerror / console error → eventual ready
 *   Scenario D: blocked sample fetch → safe alert copy, no crash
 *
 * CI: `npm run test:e2e` from repo root (starts devstack unless PLAYWRIGHT_SKIP_WEBSERVER=1).
 */

import { expect, test } from '@playwright/test';

import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';
import { waitForEditorRouteReady } from './helpers/editorReady';
import {
  expectTransportPlaybackNotReady,
  expectTransportPlaybackReady,
  expectTransportPlaybackRunningAfterInit,
  getTransportPlayButton,
  getTransportToolbar,
} from './helpers/transport';

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
  await submitRegisterFormAndExpectProjects(page);

  await page.locator('#new-project-name').fill(projectName);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i);

  await waitForEditorRouteReady(page);
}

test.describe('TASK-4.2 — piano sample loading (E2E)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('Scenario A — Play shows piano-oriented loading then reaches audio-ready', async ({ page }) => {
    await page.route('**/samples/**', async (route) => {
      await new Promise((r) => setTimeout(r, 200));
      await route.continue();
    });

    await registerAndOpenEditor(page);

    const transport = getTransportToolbar(page);
    await expect(transport).toBeVisible();
    await expectTransportPlaybackNotReady(transport);

    const playBtn = getTransportPlayButton(transport);
    await playBtn.click();

    await expectTransportPlaybackReady(transport);

    // First Play runs initializeAudio then play(); toolbar shows Pause, not Play.
    await expectTransportPlaybackRunningAfterInit(transport);
  });

  test('Scenario B — after reload, Play reaches ready (not stuck initializing)', async ({ page }) => {
    await registerAndOpenEditor(page);

    const transport = getTransportToolbar(page);
    await expect(transport).toBeVisible();
    await getTransportPlayButton(transport).click();
    await expectTransportPlaybackReady(transport);

    await page.reload();
    await waitForEditorRouteReady(page);

    const transportAfter = getTransportToolbar(page);
    await expectTransportPlaybackNotReady(transportAfter);
    await getTransportPlayButton(transportAfter).click();

    await expectTransportPlaybackReady(transportAfter);

    await expect(transportAfter.getByRole('button', { name: 'Starting…' })).toHaveCount(0);
    await expectTransportPlaybackRunningAfterInit(transportAfter);
  });

  test('Scenario C — rapid Play clicks during loading; no pageerror/console error; eventual ready', async ({
    page,
  }) => {
    await page.route('**/samples/**', async (route) => {
      await new Promise((r) => setTimeout(r, 200));
      await route.continue();
    });

    await registerAndOpenEditor(page);

    // Attach after editor shell is ready so we do not count Chrome's DevTools-style
    // "Failed to load resource … 401" for POST /api/auth/refresh on earlier navigations
    // (expected when no session cookie yet — PAT-029 bootstrap noise).
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

    const transport = getTransportToolbar(page);
    const playBtn = getTransportPlayButton(transport);

    await playBtn.evaluate((el: HTMLButtonElement) => {
      for (let i = 0; i < 50; i += 1) {
        el.click();
      }
    });

    await expectTransportPlaybackReady(transport);

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

    // Scope to transport: ToastHost also uses role="alert" for errors (strict mode duplicate otherwise).
    const transportError = transport.getByRole('alert');
    await expect(transportError).toBeVisible({ timeout: 45_000 });
    await expect(transportError).toContainText(/sample|connection|try again|audio/i);
  });
});
