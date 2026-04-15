/*
 * QA COVERAGE PLAN — TASK-8.4
 *
 * Criterion: Axe scans non-canvas surfaces; canvas excluded (UX §9).
 *   happy: /login, /register, /projects, editor chrome — zero axe violations with application/canvas excluded.
 *   edges: keyboard activation of transport Play after focus (smoke).
 */

import { expect, test } from '@playwright/test';

import { expectNoAxeViolationsExcludingCanvas } from './helpers/a11y';
import { waitForEditorRouteReady } from './helpers/editorReady';
import {
  expectTransportPlaybackReady,
  getTransportPauseButton,
  getTransportPlayButton,
  getTransportToolbar,
} from './helpers/transport';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';

test.describe('TASK-8.4 — axe on non-canvas surfaces (canvas excluded)', () => {
  test.describe.configure({ mode: 'parallel' });

  test('login route has no axe violations outside canvas', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible({
      timeout: 15_000,
    });
    await expectNoAxeViolationsExcludingCanvas(page);
  });

  test('register route has no axe violations outside canvas', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible({
      timeout: 15_000,
    });
    await expectNoAxeViolationsExcludingCanvas(page);
  });

  test('project list has no axe violations outside canvas after registration', async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const email = `e2e-a11y-${suffix}@vybpad-e2e.test`;

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(`A11y ${suffix}`);
    await page.locator('#register-password').fill('E2ETestPass-123');
    await submitRegisterFormAndExpectProjects(page);

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expectNoAxeViolationsExcludingCanvas(page);
  });

  test('editor shell (toolbar, panels, transport) has no axe violations with canvas excluded', async ({
    page,
  }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const email = `e2e-a11y-ed-${suffix}@vybpad-e2e.test`;

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(`A11y Ed ${suffix}`);
    await page.locator('#register-password').fill('E2ETestPass-123');
    await submitRegisterFormAndExpectProjects(page);

    await page.locator('#new-project-name').fill(`A11y Proj ${suffix}`);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i);

    await waitForEditorRouteReady(page);
    await expect(page.getByRole('complementary', { name: /Chord palette panel/i })).toBeVisible({
      timeout: 15_000,
    });
    await expectNoAxeViolationsExcludingCanvas(page);
  });

  test('keyboard: focused transport Play activates playback (Enter) without canvas axe scope', async ({
    page,
  }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const email = `e2e-a11y-kb-${suffix}@vybpad-e2e.test`;

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(`A11y KB ${suffix}`);
    await page.locator('#register-password').fill('E2ETestPass-123');
    await submitRegisterFormAndExpectProjects(page);

    await page.locator('#new-project-name').fill(`A11y KB Proj ${suffix}`);
    await page.getByRole('button', { name: 'Create project' }).click();
    await waitForEditorRouteReady(page);

    const transport = getTransportToolbar(page);
    const play = getTransportPlayButton(transport);
    await play.focus();
    await expect(play).toBeFocused();
    await page.keyboard.press('Enter');
    await expectTransportPlaybackReady(transport);
    await expect(getTransportPauseButton(transport)).toBeVisible({ timeout: 90_000 });
    await expectNoAxeViolationsExcludingCanvas(page);
  });
});
