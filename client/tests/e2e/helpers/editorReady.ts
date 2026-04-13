import { expect, type Page } from '@playwright/test';

import { getTransportToolbar } from './transport';

/**
 * Regex for `toHaveURL` / navigation gates (TASK-4.3).
 * Always use `new RegExp(...)`: a regex literal cannot contain `(?:/` — the `/` terminates the literal (esbuild/Babel).
 */
export function expectedEditorUrlRegex(projectId?: string): RegExp {
  if (projectId) {
    return new RegExp(`/editor/${projectId}(?:/|[?#]|$)`, 'i');
  }
  return new RegExp('\\/editor\\/[0-9a-f-]{36}(?:\\/|[?#]|$)', 'i');
}

/**
 * Waits until the editor route has finished loading project JSON and the shell
 * (canvas + transport toolbar) is present. Use before chord edits or transport
 * assertions so tests do not race hydration (TASK-4.2 remediation).
 */
const SHELL_READY_TIMEOUT_MS = 45_000;

export async function waitForEditorRouteReady(page: Page): Promise<void> {
  await expect(page.getByText('Loading project…')).toBeHidden({ timeout: SHELL_READY_TIMEOUT_MS });
  await expect(page.getByRole('application', { name: /Song editor/i })).toBeVisible({
    timeout: SHELL_READY_TIMEOUT_MS,
  });
  await expect(getTransportToolbar(page)).toBeVisible({ timeout: SHELL_READY_TIMEOUT_MS });
}
