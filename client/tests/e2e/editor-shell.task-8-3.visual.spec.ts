/*
 * QA COVERAGE PLAN — TASK-8.3
 *
 * Criterion: Playwright screenshot baselines for stable editor/auth states (UX §4 viewport ≥1024×768).
 *   happy: login, register, projects, empty editor (chord palette open by default), populated grid, transport toolbar while playing (full-page height can flake; toolbar shot is stable).
 *   flake control: reduced motion, zero-duration transitions, optional canvas mask while transport is running.
 *
 * ─── Updating baselines (Designer sign-off) ───────────────────────────────────
 * When UI changes are intentional (Designer-approved), regenerate PNGs from the repo root:
 *   PLAYWRIGHT_BASE_URL=… PLAYWRIGHT_API_URL=… npx playwright test --project=visual --update-snapshots
 * Use the same PAT-030 port pair as in this worktree’s `.env` (see PATTERNS.md PAT-030).
 * Commit the updated `*-snapshots/**` files with the PR and note Designer approval in the PR body.
 * @see docs/E2E_EDITOR.md — authenticated editor flows for visual baselines.
 */

import { expect, test, type Page } from '@playwright/test';

import { waitForEditorRouteReady } from './helpers/editorReady';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';
import {
  clickTransportPlayAndAwaitReady,
  getTransportPauseButton,
  getTransportToolbar,
} from './helpers/transport';

async function disableCssAnimationFlake(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content: `*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;}`,
  });
}

test.describe('TASK-8.3 — visual regression (project=visual)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('login page baseline', async ({ page }) => {
    await disableCssAnimationFlake(page);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveScreenshot('login.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixels: 800,
    });
  });

  test('register page baseline', async ({ page }) => {
    await disableCssAnimationFlake(page);
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveScreenshot('register.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixels: 800,
    });
  });

  test('project list baseline after registration', async ({ page }) => {
    await disableCssAnimationFlake(page);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const email = `e2e-visual-${suffix}@vybpad-e2e.test`;

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(`Visual ${suffix}`);
    await page.locator('#register-password').fill('E2ETestPass-123');
    await submitRegisterFormAndExpectProjects(page);

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveScreenshot('projects.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixels: 800,
    });
  });

  test('editor: empty grid, populated grid, transport playing (palette open by default)', async ({
    page,
  }) => {
    await disableCssAnimationFlake(page);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const email = `e2e-visual-ed-${suffix}@vybpad-e2e.test`;

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(`Visual Ed ${suffix}`);
    await page.locator('#register-password').fill('E2ETestPass-123');
    await submitRegisterFormAndExpectProjects(page);

    await page.locator('#new-project-name').fill(`Visual Proj ${suffix}`);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i);

    await waitForEditorRouteReady(page);
    await expect(page.getByRole('complementary', { name: /Chord palette panel/i })).toBeVisible();

    await expect(page).toHaveScreenshot('editor-empty.png', {
      fullPage: true,
      animations: 'disabled',
      /** Canvas + font rasterization can drift slightly between runs; keep threshold for stable CI. */
      maxDiffPixels: 4500,
    });

    await page.getByTestId('chord-palette-degree-1').click();
    await expect(page.getByRole('button', { name: /^Save$/ })).toBeEnabled({ timeout: 45_000 });
    await expect(page).toHaveScreenshot('editor-populated.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixels: 4500,
    });

    const transport = getTransportToolbar(page);
    await clickTransportPlayAndAwaitReady(transport);
    await expect(getTransportPauseButton(transport)).toBeVisible({ timeout: 90_000 });

    /** Toolbar only — full-page height can differ between runs (scrollbars / layout); Pause + beat readout still covered. */
    await expect(getTransportToolbar(page)).toHaveScreenshot('editor-transport-playing.png', {
      animations: 'disabled',
      maxDiffPixels: 800,
    });
  });
});
