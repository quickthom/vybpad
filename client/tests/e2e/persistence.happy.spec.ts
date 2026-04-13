/*
 * QA COVERAGE PLAN — TASK-3.5 (+ TASK-4.2 remediation: editor shell + chord entry)
 *
 * Criterion: Happy-path E2E — register → create project → editor → chord grid edit → persist → refresh →
 *   logout/login → project list + editor reload with persisted song (verified via API contract).
 *   happy: full UI flow + GET /api/projects/:id shows edited chords after re-auth
 *   error: (not required for foundation baseline)
 *   edges: —
 *
 * INTERFACES.md — GET /api/projects/:id → ProjectResponse; assertions use `songData.measures[].chords` only.
 *
 * Entry mode: Table mode is required for digit-only chord adds (Text mode ignores digits until a duration key
 * arms entry — see useKeyboard). We assert `Entry mode Table` before typing so CI cannot silently run in Text.
 *
 * Persist: after edits, wait for `Save` enabled (dirty), then **explicit Save** to flush PUT. Relying only on
 * debounced autosave in CI proved flaky (runner timer coalescing / effect churn) while local state was dirty;
 * after Save, **wait for `PUT /api/projects/:id` (2xx)** — not for Save to disable — then poll GET until chords
 * match (Save can stay enabled while the request finishes or if UI dirty state lags).
 *
 * Shell: `waitForEditorRouteReady` ensures canvas + transport are present before chord entry (no hydration races).
 */

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { waitForEditorRouteReady } from './helpers/editorReady';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';

const API_BASE = (process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');

/** PAT-012 — chord strip sits below the measure header; target mid-strip for hit-testing. */
const CHORD_STRIP_CLICK_Y = 24 + 40 / 2;

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Text mode does not apply chord digits until a duration key arms entry — force Table for digit-only adds. */
async function ensureTableEntryMode(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: /Entry mode (Table|Text)/ });
  await expect(btn).toBeVisible({ timeout: 15_000 });
  const label = await btn.getAttribute('aria-label');
  if (label?.includes('Text')) {
    await btn.click();
    await expect(btn).toHaveAttribute('aria-label', /Entry mode Table/);
  }
}

/**
 * Focus the chord table for digit entry: click inside the first visible measure’s chord row
 * (viewport-stable vs a fixed x) and assert the editor canvas is focused so window key handlers run.
 */
async function focusChordStripForDigitEntry(canvas: Locator): Promise<void> {
  const box = await canvas.boundingBox();
  expect(box, 'editor canvas should have a layout box').toBeTruthy();
  const w = box!.width;
  const h = box!.height;
  const x = Math.min(Math.max(40, w * 0.1), w - 4);
  const y = Math.min(Math.max(28, CHORD_STRIP_CLICK_Y), h - 4);
  await canvas.click({ position: { x, y } });
  await expect(canvas).toBeFocused({ timeout: 15_000 });
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
  // INTERFACES.md — GET /api/projects/:id → ProjectResponse
  return res.json() as Promise<{
    id: string;
    name: string;
    songData: { measures: Array<{ chords: Array<{ scaleDegree: number; beat: number }> }> };
    updatedAt: string;
  }>;
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
    await ensureTableEntryMode(page);

    const canvas = page.getByRole('application', { name: /Song editor/i });
    await expect(page.getByRole('button', { name: /^Save$/ })).toBeDisabled({ timeout: 30_000 });
    // Transport tempo `<input type="number">` is focusable; if it ever holds focus, digit keys are skipped by
    // useKeyboard (`isEditableKeyboardTarget`). Blur before chord entry (TASK-4.2 CI remediation).
    await page.locator('#transport-tempo-input').blur();
    await focusChordStripForDigitEntry(canvas);
    // Slower typing avoids coalescing both digits before the first chord mutation on slow CI workers.
    await page.keyboard.type('12', { delay: 120 });

    await expect(page.getByRole('button', { name: /^Save$/ })).toBeEnabled({ timeout: 30_000 });
    const putProjectPromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/projects/${id}`) && r.request().method() === 'PUT',
      { timeout: 60_000 },
    );
    await page.getByRole('button', { name: /^Save$/ }).click();
    const putRes = await putProjectPromise;
    expect(
      putRes.ok(),
      `PUT /api/projects/${id} failed: ${putRes.status()} ${await putRes.text().catch(() => '')}`,
    ).toBeTruthy();

    await expect
      .poll(
        async () => {
          const token = (await loginApi(request, email, password)).accessToken;
          const remote = await fetchProject(request, token, id);
          return (remote.songData.measures[0]?.chords?.length ?? 0) >= 2;
        },
        {
          timeout: 60_000,
          intervals: [100, 200, 400, 800, 1500],
          message:
            'Expected explicit Save to persist ≥2 entered chords (poll GET /api/projects/:id until songData reflects the PUT)',
        },
      )
      .toBe(true);

    let token = (await loginApi(request, email, password)).accessToken;
    let remote = await fetchProject(request, token, id);
    expect(remote.songData.measures[0]?.chords?.length ?? 0).toBeGreaterThanOrEqual(2);

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
    const chords = remote.songData.measures[0]?.chords ?? [];
    expect(chords.length).toBeGreaterThanOrEqual(2);
    const degrees = chords.map((c) => c.scaleDegree).sort((a, b) => a - b);
    expect(degrees).toContain(1);
    expect(degrees).toContain(2);
  });
});
