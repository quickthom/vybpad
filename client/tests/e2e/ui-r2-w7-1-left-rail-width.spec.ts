/*
 * QA COVERAGE PLAN — UI-R2-W7.1
 *
 * Criterion 1 — Width math at 1280px viewport
 *   happy: left panel and right rail defaults yield a center editor width in the 65–70% target
 *   error: 288px legacy left default or math outside acceptance ratio.
 *
 * Criterion 2 — Collapse-to-rail and OB-16 safety
 *   happy: collapse to 48px with preserved expand path and no document-level scroll regressions.
 *   error: collapsing or expanding should not cause document scroll and repeated toggles should stay deterministic.
 */

import { expect, test, type Page } from '@playwright/test';

import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';
import { waitForEditorRouteReady } from './helpers/editorReady';

const VIEWPORT_WIDTH_PX = 1280;
const VIEWPORT_HEIGHT_PX = 800;
const CENTER_COLUMN_MIN_RATIO = 0.65;
const CENTER_COLUMN_MAX_RATIO = 0.7;
const COLLAPSED_PANEL_WIDTH_PX = 48;

async function bootstrapEditor(page: Page): Promise<void> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const email = `qa-left-rail-${suffix}@vybpad-e2e.test`;
  const password = 'e2e-pass-W7-1!';
  const displayName = `QA W7.1 ${suffix}`;
  const projectName = `QA W7.1 project ${suffix}`;

  await page.goto('/register');
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('textbox', { name: /display name/i }).fill(displayName);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await submitRegisterFormAndExpectProjects(page);

  await page.getByRole('button', { name: /create project/i }).click();
  await page.getByRole('textbox', { name: /project name/i }).fill(projectName);
  await page.getByRole('button', { name: /create project/i }).click();
  await waitForEditorRouteReady(page);
}

async function getEditorPanelMetrics(page: Page): Promise<{
  leftWidth: number;
  rightWidth: number;
  centerWidth: number;
  pageHasScroll: boolean;
  shellOverflowY: string;
}> {
  return page.evaluate(() => {
    const leftPanel = document.querySelector('#vybpad-panel-chords');
    const row = leftPanel?.parentElement;
    const left = leftPanel?.getBoundingClientRect().width ?? 0;
    const center = row?.children.item(1)?.getBoundingClientRect().width ?? 0;
    const right = row?.children.item(2)?.getBoundingClientRect().width ?? 0;
    const doc = document.documentElement;
    const shell = document.querySelector('div.flex.min-h-screen.flex-col');
    const shellStyle = window.getComputedStyle(shell ?? document.body);
    return {
      leftWidth: left,
      rightWidth: right,
      centerWidth: center,
      pageHasScroll: doc.scrollHeight > doc.clientHeight || doc.scrollWidth > doc.clientWidth,
      shellOverflowY: shellStyle.overflowY,
    };
  });
}

test.describe('UI-R2-W7.1 — left rail width and collapse behavior', () => {
  test.describe.configure({ mode: 'serial' });

  test('keeps default center allocation at 65–70% of 1280px', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORT_WIDTH_PX, height: VIEWPORT_HEIGHT_PX });
    await bootstrapEditor(page);

    const metrics = await getEditorPanelMetrics(page);
    expect(metrics.leftWidth, 'left rail should be present in layout math').toBeGreaterThan(0);
    expect(metrics.rightWidth, 'right rail should be present in layout math').toBeGreaterThan(0);
    expect(metrics.leftWidth, 'legacy 288px default should no longer be the left-rail default').toBeLessThan(288);
    expect(metrics.centerWidth, 'center width should be 65–70% of a 1280px viewport').toBeGreaterThanOrEqual(
      VIEWPORT_WIDTH_PX * CENTER_COLUMN_MIN_RATIO,
    );
    expect(metrics.centerWidth, 'center width should be 65–70% of a 1280px viewport').toBeLessThanOrEqual(
      VIEWPORT_WIDTH_PX * CENTER_COLUMN_MAX_RATIO,
    );
  });

  test('collapses to 48px, re-expands, and preserves OB-16 no-scroll intent', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORT_WIDTH_PX, height: VIEWPORT_HEIGHT_PX });
    await bootstrapEditor(page);

    const chordsToggle = page.getByRole('button', { name: 'Chords' });
    const expanded = await getEditorPanelMetrics(page);
    expect(expanded.leftWidth).toBeGreaterThan(COLLAPSED_PANEL_WIDTH_PX);

    await chordsToggle.click();
    const collapsed = await getEditorPanelMetrics(page);
    expect(collapsed.leftWidth).toBeCloseTo(COLLAPSED_PANEL_WIDTH_PX, 1);
    expect(collapsed.shellOverflowY).toBe('hidden');
    expect(collapsed.pageHasScroll).toBe(false);

    await chordsToggle.click();
    const expandedAgain = await getEditorPanelMetrics(page);
    expect(expandedAgain.leftWidth).toBeGreaterThan(COLLAPSED_PANEL_WIDTH_PX);
    expect(expandedAgain.pageHasScroll).toBe(false);
  });

  test('supports repeated collapse/expand toggles without creating document scroll', async ({ page }) => {
    await page.setViewportSize({ width: VIEWPORT_WIDTH_PX, height: VIEWPORT_HEIGHT_PX });
    await bootstrapEditor(page);

    const chordsToggle = page.getByRole('button', { name: 'Chords' });
    await chordsToggle.click();
    await chordsToggle.click();
    await chordsToggle.click();
    await chordsToggle.click();

    const finalMetrics = await getEditorPanelMetrics(page);
    expect(finalMetrics.leftWidth).toBeGreaterThan(COLLAPSED_PANEL_WIDTH_PX);
    expect(finalMetrics.pageHasScroll).toBe(false);
    expect(finalMetrics.shellOverflowY).toBe('hidden');
  });
});
