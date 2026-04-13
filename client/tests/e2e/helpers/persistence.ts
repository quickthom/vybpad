import type { Page, Response } from '@playwright/test';

/**
 * Autosave E2E — wait for the successful PUT that persists the open project.
 * Uses URL pathname matching so query strings or trailing slashes cannot spoof a match.
 */
export function waitForProjectAutosavePut(
  page: Page,
  projectId: string,
  timeout = 45_000,
): Promise<Response> {
  return page.waitForResponse(
    (r) => {
      if (r.request().method() !== 'PUT' || !r.ok()) return false;
      try {
        const { pathname } = new URL(r.url());
        return pathname === `/api/projects/${projectId}`;
      } catch {
        return false;
      }
    },
    { timeout },
  );
}
