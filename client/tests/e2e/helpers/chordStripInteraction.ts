import { expect, type Page } from '@playwright/test';

import { editorChordStripCenterY, editorGridPointerX } from './editorCanvasCoords';

/**
 * Chord strip hit target — RA-2 bottom strip (PAT-012). Shared by shortcut + milestone E2E.
 */
export async function clickFirstChordStrip(page: Page): Promise<void> {
  const el = page.getByRole('application', { name: /Song editor/i });
  const box = await el.boundingBox();
  expect(box, 'editor canvas bounding box').toBeTruthy();
  const x = editorGridPointerX(box!.width, 0.018, 16);
  const y = Math.min(editorChordStripCenterY(box!.height), box!.height - 8);
  await el.click({ position: { x, y } });
}
