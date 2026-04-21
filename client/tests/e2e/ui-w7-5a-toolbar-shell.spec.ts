/*
 * QA COVERAGE PLAN — UI-R2-W7.5a (RA-209 baseline toolbar shell consolidation)
 *
 * Criterion 1: Shell has one header row + one transport toolbar and no standalone loop strip.
 *   happy: full-width chrome rows counted at shell root are exactly 2.
 *   error: legacy separate loop row remains.
 *
 * Criterion 2: Shared transport shell has stable ID contract and toolbar role.
 *   happy: stable transport IDs and clusters are visible in `vybpad-transport-toolbar`.
 *   error: IDs disappear or move elsewhere.
 *
 * Criterion 3: Header-only actions are in shared transport shell and can be focused.
 *   happy: Save/Projects/Entry mode/Chords/Mixer/Settings/Piano/Key+scale/Logout/Vice controls in toolbar.
 *
 * Criterion 4: Key/meter/tempo/zoom values and loop/export controls stay in toolbar shell.
 *   happy: 4/4, Tempo=120, 100% zoom values visible and no standalone loop group sibling.
 *
 * Criterion 5: Transport init contract is represented on the shared toolbar.
 *   happy: toolbar reports non-ready at boot and ready once status updates.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { expectTransportPlaybackNotReady, expectTransportPlaybackReady } from './helpers/transport';
import { createProjectAndAwaitEditor } from './helpers/projects';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';
import { waitForEditorRouteReady } from './helpers/editorReady';

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getEditorShellRoot(page: Page): Locator {
  return page.locator('div.flex.min-h-screen.flex-col').filter({
    has: page.getByTestId('vybpad-transport-toolbar'),
  });
}

async function countFullWidthChromeRows(editorRoot: Locator, page: Page): Promise<number> {
  let total = 0;
  total += await editorRoot.locator(':scope > header').count();
  total += await editorRoot.locator(':scope > [data-testid="vybpad-transport-toolbar"]').count();
  total += await editorRoot
    .locator(':scope > [role="group"]')
    .filter({ has: page.getByLabel('Loop start') })
    .count();
  return total;
}

async function openFreshEditor(page: Page): Promise<void> {
  const suffix = uniqueSuffix();
  const email = `e2e-r2-w7-5a-${suffix}@vybpad-e2e.test`;
  const displayName = `E2E W7.5a ${suffix}`;
  const projectName = `UI-R2-W7.5a ${suffix}`;

  await page.goto('/register');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-display-name').fill(displayName);
  await page.locator('#register-password').fill('E2ETestPass-123');
  await submitRegisterFormAndExpectProjects(page);
  await createProjectAndAwaitEditor(page, projectName);
  await waitForEditorRouteReady(page);
}

test.describe('UI-R2-W7.5a — toolbar shell consolidation baseline (RA-209)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('CR1 — shell has one header row and one shared transport toolbar row', async ({ page }) => {
    await openFreshEditor(page);

    const root = getEditorShellRoot(page);
    await expect(root).toBeVisible();

    const rows = await countFullWidthChromeRows(root, page);
    expect(rows).toBe(2);
  });

  test('CR2 — transport toolbar exposes stable control IDs and role', async ({ page }) => {
    await openFreshEditor(page);
    const transport = page.getByTestId('vybpad-transport-toolbar');

    await expect(transport).toBeVisible();
    await expect(transport).toHaveAttribute('role', 'toolbar');

    for (const control of [
      'vybpad-transport-undo',
      'vybpad-transport-redo',
      'vybpad-transport-play',
      'vybpad-transport-stop',
      'vybpad-transport-rewind',
      'vybpad-transport-current-beat',
      'vybpad-transport-key-meter-cluster',
      'vybpad-zoom-readout',
      'vybpad-zoom-y-readout',
      'vybpad-midi-export-cluster',
    ] as const) {
      await expect(transport.getByTestId(control)).toBeVisible();
    }

    await expect(transport.getByRole('spinbutton', { name: /Tempo/i })).toBeVisible();
  });

  test('CR3 — key/meter/tempo/zoom values remain in transport toolbar on baseline state', async ({ page }) => {
    await openFreshEditor(page);
    const transport = page.getByTestId('vybpad-transport-toolbar');

    await expect(transport).toBeVisible();
    await expect(transport.getByTestId('vybpad-transport-key-meter-cluster')).toContainText('4/4');
    await expect(transport.getByRole('spinbutton', { name: /Tempo/i })).toHaveValue('120');
    await expect(transport.getByTestId('vybpad-zoom-readout')).toHaveText('100%');
    await expect(transport.getByTestId('vybpad-zoom-y-readout')).toHaveText('100%');
  });

  test('CR4 — header actions are represented in transport toolbar shell cluster', async ({ page }) => {
    await openFreshEditor(page);
    const transport = page.getByTestId('vybpad-transport-toolbar');

    await expect(transport).toBeVisible();

    for (const label of [
      /^Save$/i,
      /^Projects$/i,
      /Entry mode/i,
      /^Chords$/i,
      /^Mixer$/i,
      /^Settings$/i,
      /^Piano$/i,
      /Key \/ scale/i,
      /Log out/i,
    ] as const) {
      const control = transport.getByRole('button', { name: label });
      await expect(control).toBeVisible();
      await control.focus();
      await expect(control).toBeFocused();
    }

    const voice = transport.getByText(/^Voice\s+\d+/i);
    await expect(voice).toBeVisible();
  });

  test('CR5 — loop controls and export remain in toolbar; no standalone loop row', async ({ page }) => {
    await openFreshEditor(page);
    const transport = page.getByTestId('vybpad-transport-toolbar');

    await expect(transport).toBeVisible();
    const loopStart = transport.getByLabel('Loop start');
    await expect(loopStart).toBeVisible();

    const exportCluster = transport.getByTestId('vybpad-midi-export-cluster');
    await expect(exportCluster).toBeVisible();

    const root = getEditorShellRoot(page);
    const standaloneLoopRow = root
      .locator(':scope > [role="group"]')
      .filter({ has: page.getByLabel('Loop start') });
    await expect(standaloneLoopRow).toHaveCount(0);
  });

  test('CR6 — transport reports non-ready then ready state attributes on shared toolbar', async ({ page }) => {
    await openFreshEditor(page);
    const transport = page.getByTestId('vybpad-transport-toolbar');

    await expect(transport).toBeVisible();
    await expectTransportPlaybackNotReady(transport);
    await expect(transport).toHaveAttribute('data-audio-ready', 'false');
    await expectTransportPlaybackReady(transport);
  });
});
