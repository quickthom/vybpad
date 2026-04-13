import { expect, type Page } from '@playwright/test';

import { getTransportToolbar } from './transport';

/**
 * Waits until the editor route has finished loading project JSON and the shell
 * (canvas + transport toolbar) is present. Use before chord edits or transport
 * assertions so tests do not race hydration (TASK-4.2 remediation).
 */
export async function waitForEditorRouteReady(page: Page): Promise<void> {
  await expect(page.getByText('Loading project…')).toBeHidden({ timeout: 30_000 });
  await expect(page.getByRole('application', { name: /Song editor/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(getTransportToolbar(page)).toBeVisible({ timeout: 30_000 });
}
