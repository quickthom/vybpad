/*
 * QA COVERAGE — TASK-4.10 (Playback E2E expansion)
 *
 * Criterion 1: After Play, observable playback progress — INTERFACES `TransportControls.currentBeat`
 *   reflects `PlaybackStore.currentTick` via `formatTransportBeat`; must advance from the pre-play snapshot.
 *
 * Selectors: `data-testid` toolbar + `vybpad-transport-current-beat` (readout); helpers/transport.ts.
 * Canvas cursor/highlight are canvas-only; tick readout is the stable contract surface for E2E.
 */

import { expect, test } from '@playwright/test';

import { waitForEditorRouteReady } from './helpers/editorReady';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';
import {
  clickTransportPlayAndAwaitReady,
  getTransportCurrentBeatText,
  getTransportPauseButton,
  getTransportToolbar,
} from './helpers/transport';

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

test.describe('TASK-4.10 — playback surface (transport readout advances after Play)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('current measure:beat readout updates after Play while audio is running (polling; no fixed sleeps)', async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-playback-surface-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E Playback Surface ${suffix}`;
    const projectName = `E2E Playback Surface ${suffix}`;

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(displayName);
    await page.locator('#register-password').fill(password);
    await submitRegisterFormAndExpectProjects(page);

    await page.locator('#new-project-name').fill(projectName);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i);

    await waitForEditorRouteReady(page);

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
    await expect(transport).toBeVisible();

    const beatText = getTransportCurrentBeatText(transport);
    await expect(beatText).toBeVisible();

    const initialBeat = (await beatText.innerText()).trim();
    expect(initialBeat, 'Default project should expose measure:beat').toMatch(/^\d+:\d+$/);

    pageErrors.length = 0;
    consoleErrors.length = 0;

    await clickTransportPlayAndAwaitReady(transport);

    await expect(getTransportPauseButton(transport)).toBeEnabled();

    await expect(async () => {
      const now = (await beatText.innerText()).trim();
      expect(now).toMatch(/^\d+:\d+$/);
      expect(now).not.toBe(initialBeat);
    }).toPass({
      timeout: 30_000,
      intervals: [50, 100, 200, 400],
    });

    await getTransportPauseButton(transport).click();
    await expect(page.getByTestId('vybpad-transport-play')).toBeEnabled();

    expect(pageErrors, `pageerror: ${pageErrors.map((e) => e.message).join('; ')}`).toHaveLength(0);
    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });
});
