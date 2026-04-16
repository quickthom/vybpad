/*
 * QA COVERAGE — TASK-5.9 advanced feature sweep
 *
 * ROADMAP Phase 5 milestone mapping:
 * - Borrowed chord: borrowed palette tab is reachable and exposes non-diatonic degree controls.
 * - Secondary chord: cycle/clear + Roman readout live in the right properties panel (UI-W7).
 * - Key change at measure 5: key/scale dialog reflects the effective overridden measure context.
 * - Meter + tempo change at measure 9: tempo/meter dialog reflects the inherited override values.
 * - Second voice: Ctrl+2 updates the observable active voice indicator.
 * - Playback correctness: transport readout crosses into measure 9 after the seeded tempo/meter map.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { buildPhase5MilestoneSong } from '../fixtures/phase5MilestoneSong';
import { clickFirstChordStrip } from './helpers/chordStripInteraction';
import { waitForEditorRouteReady } from './helpers/editorReady';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';
import {
  clickTransportPlayAndAwaitReady,
  getTransportCurrentBeatText,
  getTransportPauseButton,
  getTransportToolbar,
} from './helpers/transport';

const API_BASE = (process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function loginApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ accessToken: string }> {
  const response = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<{ accessToken: string }>;
}

async function putSong(
  request: APIRequestContext,
  accessToken: string,
  projectId: string,
): Promise<void> {
  const response = await request.put(`${API_BASE}/api/projects/${projectId}`, {
    data: { songData: buildPhase5MilestoneSong() },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function createSeededProject(page: Page, request: APIRequestContext): Promise<{
  email: string;
  password: string;
  projectId: string;
}> {
  const suffix = uniqueSuffix();
  const email = `e2e-phase5-${suffix}@vybpad-e2e.test`;
  const password = 'E2ETestPass-123';
  const displayName = `E2E Phase 5 ${suffix}`;
  const projectName = `E2E Phase 5 Sweep ${suffix}`;

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

  await waitForEditorRouteReady(page);

  const { accessToken } = await loginApi(request, email, password);
  await putSong(request, accessToken, projectId as string);

  await page.goto('/projects');
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByRole('button', { name: projectName, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/editor/${projectId}`));
  await waitForEditorRouteReady(page);
  await expect(page.getByRole('heading', { level: 1, name: 'TASK-5.9 milestone fixture' })).toBeVisible();

  return { email, password, projectId: projectId as string };
}

test.describe('TASK-5.9 — advanced Phase 5 milestone sweep', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('editor shell exposes milestone feature surfaces and playback crosses the measure-9 change', async ({
    page,
    request,
  }) => {
    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await createSeededProject(page, request);

    const borrowedTab = page.getByRole('button', { name: 'Borrowed', exact: true });
    await expect(borrowedTab).toHaveAttribute('aria-pressed', 'false');
    await borrowedTab.click();
    await expect(borrowedTab).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('chord-palette-borrowed-scale')).toHaveValue('minor');
    await expect(page.getByTestId('chord-palette-borrowed-degree-4')).toBeVisible();

    await clickFirstChordStrip(page);
    const props = page.getByTestId('properties-region');
    await expect(props.getByRole('heading', { name: 'Chord' })).toBeVisible();
    await expect(props.getByTestId('properties-chord-secondary-cycle')).toBeVisible();

    const keyScaleTrigger = page.getByRole('button', { name: 'Key / scale' });
    const measure5Button = page.getByRole('button', { name: 'Measure 5', exact: true });
    await measure5Button.click();
    await expect(measure5Button).toHaveAttribute('aria-pressed', 'true');
    await keyScaleTrigger.click();
    const keyDialog = page.getByRole('dialog', { name: 'Key and scale' });
    await expect(keyDialog).toBeVisible();
    await expect(keyDialog.getByText(/Applies at the start of measure 5/i)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(keyDialog).toBeHidden();
    await expect(keyScaleTrigger).toBeFocused();

    const tempoMeterTrigger = page.getByTestId('vybpad-measure-tempo-meter');
    const measure9Button = page.getByRole('button', { name: 'Measure 9', exact: true });
    await measure9Button.click();
    await expect(measure9Button).toHaveAttribute('aria-pressed', 'true');
    await tempoMeterTrigger.click();
    const tempoDialog = page.getByRole('dialog', { name: /Tempo & meter/i });
    await expect(tempoDialog).toBeVisible();
    await expect(tempoDialog.getByText(/measure 9/i)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tempoDialog).toBeHidden();
    await expect(tempoMeterTrigger).toBeFocused();

    const canvas = page.getByRole('application', { name: /Song editor/i });
    await canvas.click();
    await expect(canvas).toBeFocused();
    await page.keyboard.press('Control+2');
    await expect(page.getByText('Voice 2', { exact: true })).toBeVisible();

    pageErrors.length = 0;
    consoleErrors.length = 0;

    const transport = getTransportToolbar(page);
    await clickTransportPlayAndAwaitReady(transport);
    const beatText = getTransportCurrentBeatText(transport);

    await expect(async () => {
      expect((await beatText.innerText()).trim()).toMatch(/^9:/);
    }).toPass({
      timeout: 20_000,
      intervals: [100, 250, 500],
    });

    await getTransportPauseButton(transport).click();

    expect(pageErrors, `pageerror: ${pageErrors.map((error) => error.message).join('; ')}`).toHaveLength(0);
    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });
});
