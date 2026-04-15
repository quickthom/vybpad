import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

function formatAxeViolations(
  violations: Array<{ id: string; description: string; nodes: Array<{ html: string }> }>,
): string {
  return violations
    .map(
      (v) =>
        `[${v.id}] ${v.description}\n` +
        v.nodes.slice(0, 5).map((n) => `  ${n.html}`).join('\n'),
    )
    .join('\n---\n');
}

/**
 * Runs axe on the active page while excluding the custom grid canvas (UX_GUIDELINES §9).
 * `[role="application"]` matches the Song editor surface; `canvas` catches any stray bitmaps.
 *
 * `color-contrast` is disabled: automated contrast on `--color-text-muted` / caption tiers often
 * conflicts with UX token usage until a Designer-led pass; UX §9 still requires AA for ship — track
 * via design review / visual baselines. This gate focuses on DOM structure (names, roles, keyboard)
 * without canvas noise from §9.
 */
export async function expectNoAxeViolationsExcludingCanvas(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .exclude('[role="application"]')
    .exclude('canvas')
    .disableRules(['color-contrast'])
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();

  expect(
    results.violations,
    `Axe violations (canvas / role=application excluded per UX §9):\n${formatAxeViolations(results.violations)}`,
  ).toEqual([]);
}
