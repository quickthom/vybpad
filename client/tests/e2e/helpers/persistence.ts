import type { Page, Response } from '@playwright/test';

function normalizedPathname(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    return pathname.replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
}

/**
 * Autosave E2E — wait for the successful PUT that persists the open project.
 * Uses URL pathname matching so query strings cannot spoof a match; trailing slashes are ignored so
 * client/server URL formatting differences do not flake CI.
 */
export function waitForProjectAutosavePut(
  page: Page,
  projectId: string,
  timeout = 45_000,
): Promise<Response> {
  const expected = `/api/projects/${projectId}`.replace(/\/+$/, '');
  return page.waitForResponse(
    (r) => {
      if (r.request().method() !== 'PUT' || !r.ok()) return false;
      const path = normalizedPathname(r.url());
      return path === expected;
    },
    { timeout },
  );
}
