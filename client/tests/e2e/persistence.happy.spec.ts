/*
 * QA COVERAGE PLAN — TASK-3.5
 *
 * Criterion: Happy-path E2E — register → create project → editor → chord grid edit → persist →
 *   reopen from list (client-side nav, GET /api/projects/:id) → logout/login → list + editor reload (verified via API contract).
 *   happy: full UI flow + GET /api/projects/:id shows edited chords after re-auth
 *   error: (not required for foundation baseline)
 *   edges: —
 */

import { expect, test, type APIRequestContext } from '@playwright/test';

const API_BASE = (process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function loginApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ accessToken: string }> {
  const res = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json() as Promise<{ accessToken: string }>;
}

async function fetchProject(request: APIRequestContext, accessToken: string, projectId: string) {
  const res = await request.get(`${API_BASE}/api/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json() as Promise<{
    id: string;
    name: string;
    songData: { measures: Array<{ chords: Array<{ scaleDegree: number; beat: number }> }> };
  }>;
}

test.describe('TASK-3.5 — persistence happy path', () => {
  test.describe.configure({ mode: 'serial' });

  test('register → create project → edit chords → save (PUT) → reopen project → re-login → list and editor load persisted song', async ({
    page,
    request,
  }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E User ${suffix}`;
    const projectName = `E2E Project ${suffix}`;

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(displayName);
    await page.locator('#register-password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.locator('#new-project-name').fill(projectName);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i);

    const projectId = page.url().match(/\/editor\/([0-9a-f-]{36})/i)?.[1];
    expect(projectId).toBeTruthy();
    const id = projectId as string;

    await expect(page.getByText('Loading project…')).toBeHidden({ timeout: 30_000 });

    const canvas = page.getByRole('application', { name: /Song editor/i });
    await canvas.click({ position: { x: 400, y: 120 } });
    // Route keys through the editor surface so the window capture listener sees normal key events (headless Chromium + focus).
    await canvas.press('1');
    await canvas.press('2');

    const saveButton = page.getByRole('button', { name: /^Save$/ });
    await expect(saveButton).toBeEnabled({ timeout: 10_000 });

    // Do not use `r.ok()` in the predicate: a failing PUT still yields a response, and the predicate would never match → timeout.
    const savePutPromise = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && r.url().includes(`/api/projects/${id}`),
      { timeout: 35_000 },
    );
    // Manual save avoids racing the debounced autosave timer in CI (React scheduling + load).
    await saveButton.click();

    const putRes = await savePutPromise;
    expect(putRes.ok(), await putRes.text()).toBeTruthy();

    let token = (await loginApi(request, email, password)).accessToken;
    let remote = await fetchProject(request, token, id);
    expect(remote.songData.measures[0]?.chords?.length ?? 0).toBeGreaterThanOrEqual(1);

    // Full `page.reload()` drops in-memory JWT; refresh via httpOnly cookie is unreliable across
    // dev ports (5173 vs 3001). Re-open via in-app navigation so the session stays in memory and
    // the editor still performs a fresh GET /api/projects/:id.
    await page.getByRole('button', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await page.getByRole('button', { name: projectName, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/editor/${id}`));
    await expect(page.getByText('Loading project…')).toBeHidden({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /^Save$/ })).toBeDisabled();

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: projectName, exact: true })).toBeVisible();

    await page.getByRole('button', { name: projectName, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/editor/${id}`));
    await expect(page.getByText('Loading project…')).toBeHidden({ timeout: 30_000 });

    token = (await loginApi(request, email, password)).accessToken;
    remote = await fetchProject(request, token, id);
    const chords = remote.songData.measures[0]?.chords ?? [];
    expect(chords.length).toBeGreaterThanOrEqual(2);
    const degrees = chords.map((c) => c.scaleDegree).sort((a, b) => a - b);
    expect(degrees).toContain(1);
    expect(degrees).toContain(2);
  });
});
