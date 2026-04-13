/*
 * QA — TASK-4.2: first-play sample load, reload regression, rapid play during load.
 */

import { expect, test } from '@playwright/test';

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

test.describe('TASK-4.2 — piano sample loading', () => {
  test.describe.configure({ mode: 'serial' });

  test('critical flow: open project → Play → sample loading then ready', async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-samples-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E Samples ${suffix}`;
    const projectName = `E2E Samples Project ${suffix}`;

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
    await expect(transport).toHaveAttribute('data-audio-ready', 'false');

    const playBtn = transport.getByRole('button', { name: /Start audio and play|Play/i });
    await playBtn.click();

    await expect
      .poll(
        async () => {
          const busy = await transport.getAttribute('aria-busy');
          const ready = await transport.getAttribute('data-audio-ready');
          return busy === 'true' || ready === 'true';
        },
        {
          message: 'toolbar should show busy or become ready while samples load',
          timeout: 10_000,
        },
      )
      .toBe(true);

    await expect(transport).toHaveAttribute('data-audio-ready', 'true', { timeout: 45_000 });
    await expect(transport).toHaveAttribute('aria-busy', 'false');
  });

  test('regression: reload and replay does not stay stuck in initializing', async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-samples-reload-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E Reload ${suffix}`;
    const projectName = `E2E Reload Project ${suffix}`;

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
    await transport.getByRole('button', { name: /Start audio and play|Play/i }).click();
    await expect(transport).toHaveAttribute('data-audio-ready', 'true', { timeout: 45_000 });

    await page.reload();
    await expect(page.getByText('Loading project…')).toBeHidden({ timeout: 30_000 });

    const transportAfter = page.getByRole('toolbar', { name: 'Transport' });
    await expect(transportAfter).toHaveAttribute('data-audio-ready', 'false');
    await transportAfter.getByRole('button', { name: /Start audio and play|Play/i }).click();

    await expect(transportAfter).toHaveAttribute('data-audio-ready', 'true', { timeout: 45_000 });
    await expect(transportAfter).toHaveAttribute('aria-busy', 'false');
  });

  test('rapid Play during sample load does not throw or deadlock', async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-samples-spam-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E Spam ${suffix}`;
    const projectName = `E2E Spam Project ${suffix}`;

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
    const playBtn = transport.getByRole('button', { name: /Start audio and play|Play/i });

    await playBtn.evaluate((el: HTMLButtonElement) => {
      for (let i = 0; i < 40; i += 1) {
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
});
