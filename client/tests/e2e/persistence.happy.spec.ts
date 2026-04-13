/*
 * QA COVERAGE PLAN — TASK-3.5 (+ TASK-4.2 editor shell)
 *
 * Happy-path E2E — register → create project → chord grid edit → autosave PUT → refresh → re-login → persisted song.
 * Align chord entry with `develop`: fixed canvas click + Digit1/Digit2, PUT waiter registered before keys.
 * `waitForEditorRouteReady` covers TASK-4.2 transport/canvas hydration (PAT-029).
 *
 * INTERFACES.md — GET /api/projects/:id; second chord may land in measures[1] (table caret), so we scan all measures.
 */

import { expect, test, type APIRequestContext } from '@playwright/test';

import { waitForEditorRouteReady } from './helpers/editorReady';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';

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
    updatedAt: string;
  }>;
}

function songDataHasChordScaleDegrees1And2(songData: {
  measures: Array<{ chords: Array<{ scaleDegree: number }> }>;
}): boolean {
  let has1 = false;
  let has2 = false;
  for (const m of songData.measures) {
    for (const c of m.chords ?? []) {
      if (c.scaleDegree === 1) has1 = true;
      if (c.scaleDegree === 2) has2 = true;
      if (has1 && has2) return true;
    }
  }
  return false;
}

test.describe('TASK-3.5 — persistence happy path', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('register → create project → edit chords → autosave → refresh → re-login → list and editor load persisted song', async ({
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
    await submitRegisterFormAndExpectProjects(page);

    await page.locator('#new-project-name').fill(projectName);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i);

    const projectId = page.url().match(/\/editor\/([0-9a-f-]{36})/i)?.[1];
    expect(projectId).toBeTruthy();
    const id = projectId as string;

    await waitForEditorRouteReady(page);

    const canvas = page.getByRole('application', { name: /Song editor/i });
    await expect(page.getByRole('button', { name: /^Save$/ })).toBeDisabled({ timeout: 30_000 });
    await page.locator('#transport-tempo-input').blur();
    await canvas.click({ position: { x: 400, y: 120 } });

    const savePutPromise = page.waitForResponse(
      (r) =>
        r.request().method() === 'PUT' &&
        r.url().includes(`/api/projects/${id}`) &&
        r.ok(),
      { timeout: 60_000 },
    );

    await page.keyboard.press('Digit1');
    await page.keyboard.press('Digit2');

    await expect(page.getByRole('button', { name: /^Save$/ })).toBeEnabled({ timeout: 30_000 });
    await savePutPromise;

    let token = (await loginApi(request, email, password)).accessToken;
    let remote = await fetchProject(request, token, id);
    expect(songDataHasChordScaleDegrees1And2(remote.songData)).toBe(true);

    await page.reload();
    await waitForEditorRouteReady(page);
    await expect(page.getByRole('button', { name: /^Save$/ })).toBeDisabled();

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
    const projectRowButton = page.getByRole('button', { name: projectName, exact: true });
    await expect(projectRowButton).toBeVisible();

    await projectRowButton.click();
    await expect(page).toHaveURL(new RegExp(`/editor/${id}`));
    await waitForEditorRouteReady(page);

    token = (await loginApi(request, email, password)).accessToken;
    remote = await fetchProject(request, token, id);
    const chords = remote.songData.measures.flatMap((m) => m.chords ?? []);
    const degrees = chords.map((c) => c.scaleDegree);
    expect(degrees.filter((d) => d === 1).length).toBeGreaterThanOrEqual(1);
    expect(degrees.filter((d) => d === 2).length).toBeGreaterThanOrEqual(1);
  });
});
