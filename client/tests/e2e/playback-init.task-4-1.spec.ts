/*
 * QA COVERAGE — TASK-4.1
 *
 * User gesture gates Tone.js init; transport toolbar exposes readiness for regression.
 */

import { expect, test } from '@playwright/test';

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

test.describe('TASK-4.1 — playback init (user gesture)', () => {
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
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.locator('#new-project-name').fill(projectName);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i);

    await expect(page.getByText('Loading project…')).toBeHidden({ timeout: 30_000 });

    const transport = page.getByRole('toolbar', { name: 'Transport' });
    await expect(transport).toBeVisible();

    await expect(transport).toHaveAttribute('data-audio-ready', 'false');

    const playBtn = transport.getByRole('button', { name: /Start audio and play|Play/i });
    await playBtn.click();

    await expect(transport).toHaveAttribute('data-audio-ready', 'true', { timeout: 20_000 });

    await page.reload();
    await expect(page.getByText('Loading project…')).toBeHidden({ timeout: 30_000 });

    const transportAfter = page.getByRole('toolbar', { name: 'Transport' });
    await expect(transportAfter).toHaveAttribute('data-audio-ready', 'false');
    await transportAfter.getByRole('button', { name: /Start audio and play|Play/i }).click();
    await expect(transportAfter).toHaveAttribute('data-audio-ready', 'true', { timeout: 20_000 });
  });
});
