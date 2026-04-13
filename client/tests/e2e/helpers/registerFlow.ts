import { expect, type Page } from '@playwright/test';

/** Cold CI/devstack: first API request after webServer ready can exceed default expect timeout. */
const REGISTER_FLOW_TIMEOUT_MS = 60_000;

/**
 * Submit the register form and wait for a successful API response before asserting navigation.
 * Avoids racing `toHaveURL` against a slow or still-starting API (deterministic E2E baseline).
 */
export async function submitRegisterFormAndExpectProjects(page: Page): Promise<void> {
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('/api/auth/register') && r.request().method() === 'POST',
    { timeout: REGISTER_FLOW_TIMEOUT_MS },
  );
  await page.getByRole('button', { name: 'Create account' }).click();
  const res = await responsePromise;
  expect(
    res.ok(),
    `POST /api/auth/register failed: ${res.status()} ${await res.text().catch(() => '')}`,
  ).toBeTruthy();
  await expect(page).toHaveURL(/\/projects$/, { timeout: REGISTER_FLOW_TIMEOUT_MS });
}
