/*
 * QA COVERAGE — TASK-4.1 (distinct from TASK-4.2)
 *
 * Regression: user gesture unlocks Tone / playback init. TASK-4.2 adds deferred SoundFont fetch;
 * this file intentionally does not throttle sample fetches — it only checks initStatus → ready via the toolbar.
 *
 * Contract: INTERFACES.md — TransportControls (initStatus), PlaybackStore.initializeAudio, AudioEngine.initialize.
 */

import { expect, test } from '@playwright/test';

import { waitForEditorRouteReady } from './helpers/editorReady';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';
import {
  expectTransportPlaybackNotReady,
  expectTransportPlaybackReady,
  getTransportPlayButton,
  getTransportToolbar,
} from './helpers/transport';

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

test.describe('TASK-4.1 — playback init (user gesture; not sample-load throttled)', () => {
  test.describe.configure({ mode: 'serial' });

  test('first Play click initializes audio; toolbar reports ready; reload stays usable', async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-play-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E Play ${suffix}`;
    const projectName = `E2E Play Project ${suffix}`;

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(displayName);
    await page.locator('#register-password').fill(password);
    await submitRegisterFormAndExpectProjects(page);

    await page.locator('#new-project-name').fill(projectName);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i);

    await waitForEditorRouteReady(page);

    const transport = getTransportToolbar(page);
    await expect(transport).toBeVisible();

    await expectTransportPlaybackNotReady(transport);

    const playBtn = getTransportPlayButton(transport);
    await playBtn.click();

    await expectTransportPlaybackReady(transport, { timeout: 45_000 });

    await page.reload();
    await waitForEditorRouteReady(page);

    const transportAfter = getTransportToolbar(page);
    await expectTransportPlaybackNotReady(transportAfter);
    await getTransportPlayButton(transportAfter).click();
    await expectTransportPlaybackReady(transportAfter, { timeout: 45_000 });
  });

  test('rapid play attempts during init — no page errors; toolbar reaches ready', async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-play-spam-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E Spam ${suffix}`;
    const projectName = `E2E Spam Project ${suffix}`;

    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(displayName);
    await page.locator('#register-password').fill(password);
    await submitRegisterFormAndExpectProjects(page);

    await page.locator('#new-project-name').fill(projectName);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i);

    await waitForEditorRouteReady(page);

    // Only assert on errors after the editor is up — anonymous session bootstrap may 401 `/api/auth/refresh`
    // (expected) and the browser logs that as a console error.
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const transport = getTransportToolbar(page);
    await expect(transport).toBeVisible();
    await expectTransportPlaybackNotReady(transport);

    const playBtn = getTransportPlayButton(transport);

    await playBtn.evaluate((el: HTMLButtonElement) => {
      for (let i = 0; i < 50; i += 1) {
        el.click();
      }
    });

    await expectTransportPlaybackReady(transport, { timeout: 45_000 });

    expect(pageErrors, `pageerror: ${pageErrors.map((e) => e.message).join('; ')}`).toHaveLength(0);
    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join(' | ')}`,
    ).toHaveLength(0);
  });
});