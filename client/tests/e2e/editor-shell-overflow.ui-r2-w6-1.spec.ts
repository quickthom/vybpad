/*
 * QA COVERAGE PLAN — UI-R2-W6.1 (Playwright counterpart for editor shell overflow contracts)
 *
 * Criterion 1 — No editor page-level vertical overflow.
 *   happy: loaded editor route fits its own viewport box; root document `scrollHeight` does not exceed `clientHeight`.
 *   error: document-level vertical overflow indicates chrome or rails are leaking into the page scroll.
 *   edges: small viewport (compact height) where inner-overflow contracts are exercised.
 *
 * Criterion 2 — Side rails are independently scrollable and do not move page scroll.
 *   happy: left rail inner scroller and right rail properties-region can scroll (`scrollHeight > clientHeight`), while page `scrollY` remains fixed.
 *   error: page scroll changes when rail `scrollTop` changes, or rail style does not expose vertical overflow.
 *   edges: compact viewport (chrome + rail heights near limits).
 *
 * Criterion 3 — Middle canvas host keeps horizontal overflow intent.
 *   happy: canvas host main element reports computed `overflowX = auto` and non-`hidden`/`scroll` overflowY contract.
 *   edge: same assertions after full document-ready hydration.
 *
 * Criterion 4 — Minimum viewport guard remains active for editor routes.
 *   happy: editor shell is replaced by viewport-too-narrow copy below 1024px and returns to editor at >=1024px.
 *   error: narrow widths keep rendering editor chrome or guard never reappears at small widths.
 *   edges: direct boundary around 1000px/1024px and typical small-viewport 800px case.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';
import { waitForEditorRouteReady } from './helpers/editorReady';

function getEditorShellRoot(page: Page): Locator {
  return page.locator('div.flex.min-h-screen.flex-col').filter({
    has: page.getByTestId('vybpad-transport-toolbar'),
  });
}

function getRailScrollMetrics(
  page: Page,
  selector: string,
): Promise<{ overflowY: string; scrollHeight: number; clientHeight: number; scrollTop: number }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) {
      return {
        overflowY: '',
        scrollHeight: 0,
        clientHeight: 0,
        scrollTop: 0,
      };
    }
    const style = window.getComputedStyle(el);
    return {
      overflowY: style.overflowY,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollTop: el.scrollTop,
    };
  }, selector);
}

async function injectOverflowProbe(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return;
    if (el.querySelector('[data-testid="ui-r2-w6-1-overflow-probe"]')) return;
    const probe = document.createElement('div');
    probe.setAttribute('data-testid', 'ui-r2-w6-1-overflow-probe');
    probe.style.cssText = 'height: 1600px; width: 1px';
    el.appendChild(probe);
  }, selector);
}

async function setViewportForScrollAssertions(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 320 });
}

async function openFreshEditor(page: Page): Promise<void> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const email = `e2e-ui-r2-w6-1-${suffix}@vybpad-e2e.test`;

  await page.goto('/register');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-display-name').fill(`UI-R2-W6.1 ${suffix}`);
  await page.locator('#register-password').fill('E2ETestPass-123');
  await submitRegisterFormAndExpectProjects(page);

  await page.locator('#new-project-name').fill(`UI-R2-W6.1 Project ${suffix}`);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i, { timeout: 90_000 });

  await waitForEditorRouteReady(page);
}

test.describe('UI-R2-W6.1 — shell overflow and rails scroll contract (Playwright)', () => {
  test.describe.configure({ mode: 'serial' });

  test('route has no page-level vertical overflow when chrome is viewport-bound', async ({ page }) => {
    await setViewportForScrollAssertions(page);
    await openFreshEditor(page);

    const root = getEditorShellRoot(page);
    await expect(root).toBeVisible();

    const viewportFit = await root.evaluate((el) => {
      return {
        shellHeight: Math.ceil(el.getBoundingClientRect().height),
        viewportHeight: window.innerHeight,
      };
    });
    expect(viewportFit.shellHeight).toBeLessThanOrEqual(viewportFit.viewportHeight + 1);

    const canvasHeight = await root.locator('main[aria-busy]').evaluate((el) => Math.ceil(el.getBoundingClientRect().height));

    expect(canvasHeight).toBeGreaterThan(0);
    expect(canvasHeight).toBeLessThanOrEqual(viewportFit.shellHeight);

    const noBodyScroll = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollHeight <= doc.clientHeight + 1;
    });
    expect(noBodyScroll).toBe(true);

    const pageScrollY = await page.evaluate(() => window.scrollY);
    expect(pageScrollY).toBe(0);
  });

  test('left and right rail scroll containers are independent and can scroll without changing document scroll', async ({ page }) => {
    await setViewportForScrollAssertions(page);
    await openFreshEditor(page);

    const root = getEditorShellRoot(page);
    await expect(root).toBeVisible();

    const leftScrollerSelector = '#vybpad-panel-chords div.overflow-y-auto';
    const rightScrollerSelector = '[data-testid="properties-region"]';

    await injectOverflowProbe(page, leftScrollerSelector);
    await injectOverflowProbe(page, rightScrollerSelector);

    const leftBefore = await getRailScrollMetrics(page, leftScrollerSelector);
    const rightBefore = await getRailScrollMetrics(page, rightScrollerSelector);
    expect(leftBefore.overflowY).toBe('auto');
    expect(rightBefore.overflowY).toBe('auto');
    expect(leftBefore.scrollHeight).toBeGreaterThan(leftBefore.clientHeight);
    expect(rightBefore.scrollHeight).toBeGreaterThan(rightBefore.clientHeight);

    const beforePageScroll = await page.evaluate(() => window.scrollY);

    await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      el?.scrollTo({ top: 9999, behavior: 'auto' });
    }, leftScrollerSelector);

    await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      el?.scrollTo({ top: 9999, behavior: 'auto' });
    }, rightScrollerSelector);

    const leftAfter = await getRailScrollMetrics(page, leftScrollerSelector);
    const rightAfter = await getRailScrollMetrics(page, rightScrollerSelector);
    expect(leftAfter.scrollTop).toBeGreaterThanOrEqual(0);
    expect(rightAfter.scrollTop).toBeGreaterThanOrEqual(0);
    expect(leftAfter.scrollTop).toBeGreaterThan(leftBefore.scrollTop);
    expect(rightAfter.scrollTop).toBeGreaterThan(rightBefore.scrollTop);

    const afterPageScroll = await page.evaluate(() => window.scrollY);
    expect(afterPageScroll).toBe(beforePageScroll);
  });

  test('editor min-viewport guard remains active below 1024px and recovers above threshold', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openFreshEditor(page);
    await expect(page.getByRole('application', { name: /Song editor/i })).toBeVisible({
      timeout: 90_000,
    });

    await page.setViewportSize({ width: 800, height: 720 });
    await expect(page.getByText(/vYbpad needs a display at least 1024px wide/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole('application', { name: /Song editor/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('center canvas host keeps horizontal-overflow intent after hydration', async ({ page }) => {
    await setViewportForScrollAssertions(page);
    await openFreshEditor(page);

    const root = getEditorShellRoot(page);
    await expect(root).toBeVisible();

    const overflow = await root.locator('main').evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        x: style.overflowX,
        y: style.overflowY,
      };
    });
    expect(overflow.x).toBe('auto');
    expect(overflow.y).not.toBe('auto');
    expect(overflow.y).not.toBe('scroll');
  });
});
