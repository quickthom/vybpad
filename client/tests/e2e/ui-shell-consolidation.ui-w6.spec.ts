/*
 * QA COVERAGE PLAN — UI-W6 (REF_AUDIT_1 RA-9, RA-11, RA-18; RA-15 product stubs)
 *
 * RA-9 — Fewer full-width chrome bands than pre-change baseline (UI_REMEDIATION Wave 6).
 *   happy: After consolidation, editor shell has at most two full-width primary chrome rows
 *     (header + single transport/tool strip), documented vs REF_AUDIT baseline of three
 *     (header + transport + dedicated loop strip).
 *   heuristic: header + transport toolbar + standalone loop row (loop tick inputs) counted
 *     until `data-app-chrome-row` is wired everywhere.
 *
 * RA-11 — Loop integrated with transport (no standalone loop-only band).
 *   happy: Loop start/end inputs live inside the transport toolbar (`vybpad-transport-toolbar`),
 *     not in a sibling full-width row below it.
 *
 * RA-18 — MIDI export cluster grouped trailing (UX_GUIDELINES §5.8).
 *   happy: Single labelled cluster (`role="group"` with aria-label matching /MIDI|Export/i) OR
 *     stable `data-testid="vybpad-midi-export-cluster"` wrapping Format + download + drag;
 *     cluster is not interleaved before tempo/readouts (document order after core transport).
 *
 * RA-15 — Band / Lyrics / Stable (reference parity, ARCHITECTURE-deferred features).
 *   happy: When shipped as stubs, buttons are discoverable, disabled (`disabled` or
 *     `aria-disabled`) and expose rationale (tooltip / aria-describedby pattern).
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { waitForEditorRouteReady } from './helpers/editorReady';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';
import { getTransportToolbar } from './helpers/transport';

/** REF_AUDIT RA-9 + Wave 6 doc: header + nav-in-header + transport + dedicated loop row ≈ 3 bands; target after W6 is one fewer (loop absorbed). */
const UI_W6_PRE_CHANGE_FULL_WIDTH_CHROME_ROWS = 3;

function getEditorShellRoot(page: Page): Locator {
  return page.locator('div.flex.min-h-screen.flex-col').filter({
    has: page.getByTestId('vybpad-transport-toolbar'),
  });
}

/**
 * Full-width “chrome” rows in the editor shell: title/header band, transport toolbar, and
 * a standalone loop-only strip (detected via Loop start input), matching REF_AUDIT RA-9/RA-11.
 */
async function countFullWidthChromeRows(editorRoot: Locator, page: Page): Promise<number> {
  let n = 0;
  n += await editorRoot.locator(':scope > header').count();
  n += await editorRoot.locator(':scope > [data-testid="vybpad-transport-toolbar"]').count();
  n += await editorRoot
    .locator(':scope > [role="group"]')
    .filter({ has: page.getByLabel('Loop start') })
    .count();
  return n;
}

async function openFreshEditor(page: Page): Promise<void> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const email = `e2e-uiw6-${suffix}@vybpad-e2e.test`;

  await page.goto('/register');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-display-name').fill(`UI-W6 ${suffix}`);
  await page.locator('#register-password').fill('E2ETestPass-123');
  await submitRegisterFormAndExpectProjects(page);

  await page.locator('#new-project-name').fill(`UI-W6 Proj ${suffix}`);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i, { timeout: 90_000 });
  await waitForEditorRouteReady(page);
}

test.describe('UI-W6 — shell consolidation (RA-9, RA-11, RA-18, RA-15)', () => {
  test.describe.configure({ mode: 'serial' });

  test('RA-9 — editor shell has fewer full-width chrome rows than pre–UI-W6 baseline', async ({
    page,
  }) => {
    await openFreshEditor(page);
    const root = getEditorShellRoot(page);
    await expect(root).toBeVisible();

    const rows = await countFullWidthChromeRows(root, page);
    expect(
      rows,
      `REF_AUDIT RA-9 + Wave 6: pre-change shell had ${UI_W6_PRE_CHANGE_FULL_WIDTH_CHROME_ROWS} primary rows (header + transport + loop strip); target is one fewer`,
    ).toBeLessThan(UI_W6_PRE_CHANGE_FULL_WIDTH_CHROME_ROWS);

    const tagged = await page.locator('[data-app-chrome-row]').count();
    if (tagged > 0) {
      expect(tagged).toBeLessThan(UI_W6_PRE_CHANGE_FULL_WIDTH_CHROME_ROWS);
    }
  });

  test('RA-11 — loop region is not a standalone full-width row outside the transport toolbar', async ({
    page,
  }) => {
    await openFreshEditor(page);
    const transport = getTransportToolbar(page);
    await expect(transport).toBeVisible();

    const standaloneLoopRow = getEditorShellRoot(page)
      .locator(':scope > [role="group"]')
      .filter({ has: page.getByLabel('Loop start') });
    await expect(standaloneLoopRow).toHaveCount(0);

    await expect(transport.getByLabel('Loop start')).toBeVisible();
  });

  test('RA-18 — MIDI export cluster is grouped, trailing, and keyboard-focusable (§5.8)', async ({
    page,
  }) => {
    await openFreshEditor(page);
    const transport = getTransportToolbar(page);
    await expect(transport).toBeVisible();

    const labelledGroup = transport.getByRole('group', {
      name: /MIDI|Export/i,
    });
    await expect(labelledGroup).toBeVisible();

    const cluster = transport.getByTestId('vybpad-midi-export-cluster');
    await expect(cluster).toBeVisible();

    await expect(cluster.getByText('Format', { exact: true }).first()).toBeVisible();
    await expect(cluster.getByTestId('vybpad-midi-export-download')).toBeVisible();
    await expect(
      cluster.getByRole('button', { name: /drag midi file to desktop daw/i }),
    ).toBeVisible();

    const tempo = transport.locator('#transport-tempo-input');
    await expect(tempo).toBeVisible();
    const orderOk = await tempo.evaluate((tempoEl) => {
      const toolbar = tempoEl.closest('[data-testid="vybpad-transport-toolbar"]');
      const clusterEl = toolbar?.querySelector('[data-testid="vybpad-midi-export-cluster"]');
      if (!clusterEl) return false;
      const pos = tempoEl.compareDocumentPosition(clusterEl);
      return (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    expect(orderOk).toBe(true);

    await cluster.getByTestId('vybpad-midi-export-download').focus();
    await expect(cluster.getByTestId('vybpad-midi-export-download')).toBeFocused();
  });

  test('RA-15 — Band, Lyrics, and Stable appear as disabled reference-parity stubs (or superseded control)', async ({
    page,
  }) => {
    await openFreshEditor(page);
    await expect(getTransportToolbar(page)).toBeVisible();

    for (const name of ['Band', 'Lyrics', 'Stable'] as const) {
      const ctrl = page.getByRole('button', { name, exact: true });
      await expect(ctrl).toBeVisible();
      const disabled =
        (await ctrl.getAttribute('disabled')) != null ||
        (await ctrl.getAttribute('aria-disabled')) === 'true';
      expect(disabled).toBe(true);
    }
  });
});
