import { expect, type Page } from '@playwright/test';

import { expectedEditorUrlRegex } from './editorReady';

function normalizedPathname(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    return pathname.replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
}

type CreatedProjectResponse = { id?: string };

/**
 * Deterministic project creation gate:
 * - wait for successful POST /api/projects
 * - assert editor route uses the same returned UUID
 */
export async function createProjectAndAwaitEditor(
  page: Page,
  projectName: string,
  timeout = 60_000,
): Promise<string> {
  await page.locator('#new-project-name').fill(projectName);
  const createRequest = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      r.ok() &&
      normalizedPathname(r.url()) === '/api/projects',
    { timeout },
  );
  await page.getByRole('button', { name: 'Create project' }).click();
  const response = await createRequest;
  const created = (await response.json()) as CreatedProjectResponse;
  expect(created.id, 'POST /api/projects must return project id').toBeTruthy();
  const id = created.id as string;
  expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  await expect(page).toHaveURL(expectedEditorUrlRegex(id), {
    timeout,
  });
  return id;
}
