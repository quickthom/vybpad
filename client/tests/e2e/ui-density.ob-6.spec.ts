/*
 * QA COVERAGE PLAN — OB-6 (operator backlog — global UI density / windowed comfort)
 *
 * Source: docs/audit/UI_REMEDIATION_OPERATOR_BACKLOG.md — OB-6: default scale, compact toolbar
 * height, panel padding / width caps, optional text-sm token step-down; comfortable when windowed
 * (not requiring fullscreen). Default viewport per playwright.config.ts: 1280×768 (UX §4).
 *
 * Criterion — compact transport chrome band:
 *   happy: Transport stack (`vybpad-transport-toolbar`) fits within an agreed vertical budget so
 *     the editor canvas keeps headroom at 768px viewport height (behavioral, not pixel-perfect art).
 *   edges: stable after audio idle (no persistent loading row skewing height).
 *
 * Criterion — side panel width caps:
 *   happy: Left chord rail (expanded) and right properties rail each stay within a capped width
 *     so the center editor remains usable when windowed at 1280px.
 *   edges: chord palette expanded (not collapsed strip).
 *
 * Criterion — base typography / density token:
 *   happy: Editor shell opts into compact base text (`text-sm` on shell or documented density hook)
 *     per backlog “optional text-sm / token step-down”.
 *
 * Complements: client/tests/component/EditorLayout.ui-density.ob-6.test.tsx (class contracts via Vitest).
 */

import { expect, test, type Page } from '@playwright/test';

import { waitForEditorRouteReady } from './helpers/editorReady';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';
import { getTransportToolbar } from './helpers/transport';

/** UX / OB-6 — max vertical budget for the entire transport chrome stack at default viewport. */
const OB6_TRANSPORT_CHROME_MAX_HEIGHT_PX = 84;

/** OB-6 — each fixed side rail (chord palette expanded, right inspector column) max width. */
const OB6_SIDE_RAIL_MAX_WIDTH_PX = 260;

async function openFreshEditor(page: Page): Promise<void> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const email = `e2e-ob6-${suffix}@vybpad-e2e.test`;

  await page.goto('/register');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-display-name').fill(`OB-6 ${suffix}`);
  await page.locator('#register-password').fill('E2ETestPass-123');
  await submitRegisterFormAndExpectProjects(page);

  await page.locator('#new-project-name').fill(`OB-6 Proj ${suffix}`);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i, { timeout: 90_000 });
  await waitForEditorRouteReady(page);
}

test.describe('OB-6 — UI density (windowed chrome)', () => {
  test.describe.configure({ mode: 'serial' });

  test('compact transport chrome — toolbar stack height stays within OB-6 vertical budget', async ({
    page,
  }) => {
    await openFreshEditor(page);
    const transport = getTransportToolbar(page);
    await expect(transport).toBeVisible();

    await expect
      .poll(
        async () => {
          const box = await transport.boundingBox();
          return box?.height ?? 0;
        },
        {
          message:
            'Transport toolbar bounding height should reflect settled layout (post-hydration).',
        },
      )
      .toBeGreaterThan(0);

    const height = (await transport.boundingBox())?.height ?? 0;
    expect(
      height,
      `OB-6: transport chrome should be compact enough for 768px-tall windowed layout (max ${OB6_TRANSPORT_CHROME_MAX_HEIGHT_PX}px tall)`,
    ).toBeLessThanOrEqual(OB6_TRANSPORT_CHROME_MAX_HEIGHT_PX);
  });

  test('side panel width caps — chord palette and right rail respect OB-6 max width', async ({
    page,
  }) => {
    await openFreshEditor(page);

    const chordPanel = page.locator('#vybpad-panel-chords');
    await expect(chordPanel).toBeVisible();

    const leftWidth = await chordPanel.evaluate((el) => el.getBoundingClientRect().width);
    expect(
      leftWidth,
      `OB-6: expanded chord rail should not exceed ${OB6_SIDE_RAIL_MAX_WIDTH_PX}px at default viewport`,
    ).toBeLessThanOrEqual(OB6_SIDE_RAIL_MAX_WIDTH_PX);

    const rightRail = page
      .locator('div.border-l')
      .filter({ has: page.getByTestId('properties-region') })
      .first();
    await expect(rightRail).toBeVisible();

    const rightWidth = await rightRail.evaluate((el) => el.getBoundingClientRect().width);
    expect(
      rightWidth,
      `OB-6: inspector rail should not exceed ${OB6_SIDE_RAIL_MAX_WIDTH_PX}px at default viewport`,
    ).toBeLessThanOrEqual(OB6_SIDE_RAIL_MAX_WIDTH_PX);
  });

  test('editor shell opts into compact base typography (text-sm) for global density step-down', async ({
    page,
  }) => {
    await openFreshEditor(page);

    const shell = page
      .locator('div.flex.min-h-screen.flex-col')
      .filter({ has: getTransportToolbar(page) })
      .first();
    await expect(shell).toBeVisible();

    const cls = (await shell.getAttribute('class')) ?? '';
    expect(
      cls.includes('text-sm'),
      'OB-6: root editor shell should include text-sm (or equivalent density hook) to step down default UI scale',
    ).toBe(true);
  });
});
