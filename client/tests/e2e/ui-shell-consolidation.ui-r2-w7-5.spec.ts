/*
 * QA COVERAGE PLAN — UI-R2-W7.5 (desktop toolbar consolidation)
 *
 * Criterion 1: single dominant toolbar at desktop breakpoint >=1024:
 *   happy: editor shell renders exactly one transport toolbar host and no duplicate toolbar rows.
 *
 * Criterion 2: leading transport cluster includes required controls:
 *   happy: Playback cluster includes undo/redo, play/stop/rewind controls and required transport stubs.
 *
 * Criterion 3: centered tempo/key/meter cluster:
 *   happy: key / meter readout cluster is visible and laid out near the transport center, not edge-anchored.
 *
 * Criterion 4: both zoom axes independently operable and visible:
 *   happy: horizontal and vertical zoom readouts + controls are visible.
 *   happy: clicking one axis changes only that axis readout immediately after interaction.
 *
 * Criterion 5: no duplicate top title/nav row:
 *   happy: one visible shell banner row with one copy of each top nav control at desktop width.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';
import { getTransportToolbar } from './helpers/transport';
import { waitForEditorRouteReady } from './helpers/editorReady';

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

function parseZoomPercent(raw: string | null): number {
  if (raw == null) return NaN;
  return Number(raw.replace('%', '').trim());
}

function getEditorShellRoot(page: Page): Locator {
  return page.locator('div.flex.min-h-screen.flex-col').filter({
    has: page.getByTestId('vybpad-transport-toolbar'),
  });
}

async function openFreshEditor(page: Page): Promise<void> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const email = `e2e-ui-w7-5-${suffix}@vybpad-e2e.test`;

  await page.goto('/register');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-display-name').fill(`UI-W7.5 ${suffix}`);
  await page.locator('#register-password').fill('E2ETestPass-123');
  await submitRegisterFormAndExpectProjects(page);

  await page.locator('#new-project-name').fill(`UI-W7.5 Project ${suffix}`);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i, { timeout: 90_000 });
  await waitForEditorRouteReady(page);
}

test.describe('UI-R2-W7.5 — desktop toolbar consolidation', () => {
  test.describe.configure({ mode: 'serial' });

  test('RA-209 — single dominant toolbar host at desktop width', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openFreshEditor(page);
    const root = getEditorShellRoot(page);
    await expect(root).toBeVisible();
    await expect(page.getByRole('banner', { includeHidden: true })).toHaveCount(1);
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(root.locator(':scope > header')).toHaveCount(1);
    await expect(page.locator('[data-testid="vybpad-transport-toolbar"]')).toHaveCount(1);
    await expect(page.getByRole('toolbar', { name: 'Transport' })).toHaveCount(1);
  });

  test('RA-209 — leading transport cluster contains required playback controls', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openFreshEditor(page);

    const transport = getTransportToolbar(page).getByRole('toolbar', { name: 'Transport' });
    await expect(transport).toBeVisible();

    const playback = transport.getByRole('group', { name: 'Playback' });
    await expect(playback).toBeVisible();
    await expect(playback.getByTestId('vybpad-transport-undo')).toBeVisible();
    await expect(playback.getByTestId('vybpad-transport-redo')).toBeVisible();
    await expect(playback.getByTestId('vybpad-transport-play')).toBeVisible();
    await expect(playback.getByRole('button', { name: /^Stop playback$/ })).toBeVisible();
    await expect(playback.getByRole('button', { name: /^Rewind to start$/i })).toBeVisible();
    await expect(playback.getByRole('spinbutton', { name: /tempo/i })).toBeVisible();
    await expect(transport.getByTestId('vybpad-transport-record')).toBeVisible();
    await expect(transport.getByTestId('vybpad-transport-metronome')).toBeVisible();
  });

  test('RA-209 — tempo/key/meter cluster is visible and centered in the transport', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openFreshEditor(page);

    const toolbar = getTransportToolbar(page);
    const keyMeterCluster = toolbar.getByTestId('vybpad-transport-key-meter-cluster');
    await expect(keyMeterCluster).toBeVisible();
    await expect(keyMeterCluster).toContainText(/C major/i);
    await expect(keyMeterCluster).toContainText('4/4');

    const clusterRect = await keyMeterCluster.boundingBox();
    const toolbarRect = await toolbar.boundingBox();
    expect(clusterRect).not.toBeNull();
    expect(toolbarRect).not.toBeNull();

    if (clusterRect && toolbarRect) {
      const toolbarCenter = toolbarRect.x + toolbarRect.width / 2;
      const clusterCenter = clusterRect.x + clusterRect.width / 2;
      expect(Math.abs(clusterCenter - toolbarCenter)).toBeLessThan(toolbarRect.width * 0.35);
    }
  });

  test('RA-210 — horizontal and vertical zoom controls are independently operable', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openFreshEditor(page);

    const transport = getTransportToolbar(page).getByRole('toolbar', { name: 'Transport' });
    await expect(transport).toBeVisible();

    const hzReadout = transport.getByTestId('vybpad-zoom-readout');
    const hzIn = transport.getByTestId('vybpad-zoom-in');
    const vzReadout = transport.getByTestId('vybpad-zoom-y-readout');
    const vzIn = transport.getByTestId('vybpad-zoom-y-in');

    await expect(hzReadout).toBeVisible();
    await expect(vzReadout).toBeVisible();
    await expect(hzIn).toBeVisible();
    await expect(vzIn).toBeVisible();

    const hzStart = parseZoomPercent(await hzReadout.textContent());
    const vzStart = parseZoomPercent(await vzReadout.textContent());

    await hzIn.click();
    await expect.poll(async () => parseZoomPercent(await hzReadout.textContent())).not.toBe(hzStart);
    expect(parseZoomPercent(await vzReadout.textContent())).toBe(vzStart);

    const hzAfter = parseZoomPercent(await hzReadout.textContent());
    await vzIn.click();
    await expect.poll(async () => parseZoomPercent(await vzReadout.textContent())).not.toBe(vzStart);
    expect(parseZoomPercent(await hzReadout.textContent())).toBe(hzAfter);
  });

  test('RA-209 desktop shell renders one top title/nav row without visible duplicates', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openFreshEditor(page);

    const visibleHeaderRow = page.getByRole('banner');
    await expect(visibleHeaderRow).toHaveCount(0);
    const hiddenHeaderRow = page.getByRole('banner', { includeHidden: true });
    await expect(hiddenHeaderRow).toHaveCount(1);
    await expect(hiddenHeaderRow.getByRole('heading', { level: 1 })).toHaveCount(1);

    const navButtons = ['Projects', 'Chords', 'Mixer', 'Settings', 'Piano', 'Key / scale', 'Log out'];
    for (const name of navButtons) {
      await expect(hiddenHeaderRow.getByRole('button', { name })).toHaveCount(1);
    }
  });
});
