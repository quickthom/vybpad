/*
 * QA COVERAGE PLAN — 4.3 (E2E robustness)
 *
 * A) Load progression fixture with varied chords → Play → no runtime errors
 * B) Refresh + replay regression still succeeds
 * C) Edge progression (borrowed / secondary / inversion mix) stays responsive — no unhandled errors
 *
 * Note-level audio assertions are out of scope until scheduler 4.4; gates are crash/readiness only.
 *
 * Selectors: `helpers/transport` — `data-testid` toolbar + play (TASK-4.3); readiness polls `data-audio-ready`
 * + `aria-busy`. `clickTransportPlayAndAwaitReady` optionally observes piano sample load UI then asserts ready.
 */

import type { SongData } from '@vybpad/shared';
import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  buildEdgeCaseVoicingSong,
  buildVoicingHeavySong,
} from '../fixtures/voicingHeavySong';
import { waitForEditorRouteReady } from './helpers/editorReady';
import { clickTransportPlayAndAwaitReady, getTransportToolbar } from './helpers/transport';

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

async function putSong(
  request: APIRequestContext,
  accessToken: string,
  projectId: string,
  songData: SongData,
): Promise<void> {
  const res = await request.put(`${API_BASE}/api/projects/${projectId}`, {
    data: { songData },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

test.describe('TASK-4.3 — harmony voicing playback resilience (E2E)', () => {
  test.describe.configure({ mode: 'serial' });

  test('scenario A — voicing-heavy progression: play causes no page errors; transport reaches ready', async ({
    page,
    request,
  }) => {
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

    const suffix = uniqueSuffix();
    const email = `e2e-voicing-a-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E Voicing A ${suffix}`;
    const projectName = `E2E Voicing Heavy ${suffix}`;

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

    await waitForEditorRouteReady(page);

    const { accessToken } = await loginApi(request, email, password);
    await putSong(request, accessToken, id, buildVoicingHeavySong());

    await page.reload();
    await waitForEditorRouteReady(page);

    const transport = getTransportToolbar(page);
    await clickTransportPlayAndAwaitReady(transport);

    expect(pageErrors, `pageerror: ${pageErrors.map((e) => e.message).join('; ')}`).toHaveLength(0);
    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('scenario B — refresh after successful play keeps editor usable and play reaches ready again', async ({
    page,
    request,
  }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-voicing-b-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E Voicing B ${suffix}`;
    const projectName = `E2E Voicing Refresh ${suffix}`;

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

    await waitForEditorRouteReady(page);

    const { accessToken } = await loginApi(request, email, password);
    await putSong(request, accessToken, id, buildVoicingHeavySong());

    await page.reload();
    await waitForEditorRouteReady(page);

    const transport1 = getTransportToolbar(page);
    await clickTransportPlayAndAwaitReady(transport1);

    await page.reload();
    await waitForEditorRouteReady(page);

    const transport2 = getTransportToolbar(page);
    await clickTransportPlayAndAwaitReady(transport2);
  });

  test('scenario C — edge progression (borrowed / secondary / inversion mix): no page or console errors after play', async ({
    page,
    request,
  }) => {
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

    const suffix = uniqueSuffix();
    const email = `e2e-voicing-c-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E Voicing C ${suffix}`;
    const projectName = `E2E Voicing Edge ${suffix}`;

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

    await waitForEditorRouteReady(page);

    const { accessToken } = await loginApi(request, email, password);
    await putSong(request, accessToken, id, buildEdgeCaseVoicingSong());

    await page.reload();
    await waitForEditorRouteReady(page);

    const transport = getTransportToolbar(page);
    await clickTransportPlayAndAwaitReady(transport);

    expect(pageErrors, `pageerror: ${pageErrors.map((e) => e.message).join('; ')}`).toHaveLength(0);
    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });
});
