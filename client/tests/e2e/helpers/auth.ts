import { expect, type Page } from '@playwright/test';

function normalizedPathname(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    return pathname.replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
}

/**
 * UI registration flow with deterministic API gate (INTERFACES auth contract).
 * Surfaces `POST /api/auth/register` failures immediately instead of timing out on URL alone.
 */
export async function registerAccountAndExpectProjectsShell(
  page: Page,
  opts: { email: string; password: string; displayName: string },
): Promise<void> {
  await page.goto('/register');
  await page.locator('#register-email').fill(opts.email);
  await page.locator('#register-display-name').fill(opts.displayName);
  await page.locator('#register-password').fill(opts.password);
  const registerResponsePromise = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      normalizedPathname(r.url()) === '/api/auth/register',
    { timeout: 60_000 },
  );
  await page.getByRole('button', { name: 'Create account' }).click();
  const registerResponse = await registerResponsePromise;
  expect(
    registerResponse.ok(),
    `POST /api/auth/register failed: HTTP ${registerResponse.status()} — ${await registerResponse.text()}`,
  ).toBeTruthy();
  await expect(page).toHaveURL(/\/projects(?:$|[?#])/i, { timeout: 60_000 });
}
