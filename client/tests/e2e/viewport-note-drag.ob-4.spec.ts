/*
 * QA COVERAGE PLAN — OB-4
 *
 * Criterion 1: While dragging a note, the canvas does not disappear/flash white and viewport state does not
 *   reset in a user-visible way (e.g. sudden jump to measure 0 or loss of scroll/zoom context).
 *   happy: After non-default zoom, horizontal note drag completes; transport zoom readout unchanged; canvas still
 *     visible; center pixel at note position stays non-white (grid is painted).
 *   error: (not a distinct API error) — covered by regression checks above.
 *   edges: zoom-only viewport stress (scrollY 0); drag delta exceeds DRAG_THRESHOLD_PX (4).
 *
 * Criterion 2: Behavior is verifiable via automated test (Playwright E2E + layout-aligned pointer coords).
 *   happy: Drag sequence uses computeNoteBlockRect + pitch gutter offset matching the editor layout.
 *
 * Criterion 3: Automated regression — run on branch before merge; should fail if zoom jumps or canvas reads
 *   all-white (765) / cleared (≈0) at the melody probe after drag.
 *
 * INTERFACES.md — Viewport { startMeasure, measureCount, scrollY, zoom }; observable zoom via
 * TransportControls zoom readout (data-testid vybpad-zoom-readout).
 */

import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type { NoteEvent, SongData, Viewport } from '@vybpad/shared';

import { computeNoteBlockRect } from '../../src/engine/renderer/noteBlocks';
import { EDITOR_CANVAS_PITCH_GUTTER_PX } from './helpers/editorCanvasCoords';
import { waitForEditorRouteReady } from './helpers/editorReady';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';

const API_BASE = (process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function loginApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ accessToken: string }> {
  const res = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json() as Promise<{ accessToken: string }>;
}

async function fetchProjectSong(
  request: APIRequestContext,
  accessToken: string,
  projectId: string,
): Promise<SongData> {
  const res = await request.get(`${API_BASE}/api/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { songData: SongData };
  return body.songData;
}

async function putProjectSong(
  request: APIRequestContext,
  accessToken: string,
  projectId: string,
  songData: SongData,
): Promise<void> {
  const res = await request.put(`${API_BASE}/api/projects/${projectId}`, {
    data: { songData },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

/** Same shape as TASK-8.2 full workflow — one quarter-note melody (voice 0) at beat 0. */
async function addMelodyQuarterNoteVoice0(
  request: APIRequestContext,
  accessToken: string,
  projectId: string,
): Promise<NoteEvent> {
  const song = await fetchProjectSong(request, accessToken, projectId);
  const m0 = song.measures[0];
  expect(m0, 'measure 0').toBeTruthy();
  const n: NoteEvent = {
    id: randomUUID(),
    scaleDegree: 1,
    octave: 0,
    chromatic: 0,
    beat: 0,
    duration: 48,
    isRest: false,
    velocity: 100,
  };
  m0!.notes[0].push(n);
  await putProjectSong(request, accessToken, projectId, song);
  return n;
}

function parseZoomPercent(readout: string): number {
  const n = Number.parseInt(readout.replace(/%/g, '').trim(), 10);
  expect(Number.isFinite(n)).toBe(true);
  return n / 100;
}

function viewportFromReadout(zoom: number): Viewport {
  return {
    startMeasure: 0,
    measureCount: 8,
    scrollY: 0,
    zoom,
  };
}

/** Canvas-relative CSS pixel coordinates for pointer actions (matches EditorCanvas viewport X + pitch gutter). */
const DEFAULT_MELODY_ROW_HEIGHT_PX = 20;

function noteDragPointerPositions(song: SongData, viewport: Viewport, note: NoteEvent): {
  startX: number;
  startY: number;
} {
  const rect = computeNoteBlockRect({
    song,
    viewport,
    measureIndex: 0,
    note,
    isRest: false,
    voiceIndex: 0,
    melodyRowHeight: DEFAULT_MELODY_ROW_HEIGHT_PX,
  });
  return {
    startX: EDITOR_CANVAS_PITCH_GUTTER_PX + rect.x + rect.width / 2,
    startY: rect.y + rect.height / 2,
  };
}

/**
 * Min RGB sum in a coarse neighborhood — center-only sampling can hit anti-aliased edges, degree label ink,
 * or a one-pixel miss; the note fill is always present somewhere near the block center (PAT-010).
 */
async function minRgbSumNearCanvasPoint(
  page: Page,
  canvasCssSelector: string,
  cssX: number,
  cssY: number,
  radiusCssPx: number,
): Promise<number> {
  return page.evaluate(
    ({ sel, cssX: cx, cssY: cy, radiusCssPx: r }) => {
      const el = document.querySelector(sel) as HTMLCanvasElement | null;
      if (!el) {
        throw new Error(`Canvas not found: ${sel}`);
      }
      const ctx = el.getContext('2d');
      if (!ctx) {
        throw new Error('2d context unavailable');
      }
      const rect = el.getBoundingClientRect();
      const scaleX = el.width / rect.width;
      const scaleY = el.height / rect.height;
      let min = 9999;
      for (let dy = -r; dy <= r; dy += 4) {
        for (let dx = -r; dx <= r; dx += 4) {
          const x = cx + dx;
          const y = cy + dy;
          const ix = Math.min(el.width - 1, Math.max(0, Math.floor(x * scaleX)));
          const iy = Math.min(el.height - 1, Math.max(0, Math.floor(y * scaleY)));
          const d = ctx.getImageData(ix, iy, 1, 1).data;
          const s = d[0]! + d[1]! + d[2]!;
          if (s < min) min = s;
        }
      }
      return min;
    },
    { sel: canvasCssSelector, cssX, cssY, radiusCssPx },
  );
}

test.describe('OB-4 — viewport stability during note drag', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('after zoom-in, dragging a melody note horizontally keeps zoom readout stable and canvas painted (no full white flash)', async ({
    page,
    request,
  }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-ob4-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(`OB-4 ${suffix}`);
    await page.locator('#register-password').fill(password);
    await submitRegisterFormAndExpectProjects(page);

    await page.locator('#new-project-name').fill(`OB-4 ${suffix}`);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i);
    const projectId = page.url().match(/\/editor\/([0-9a-f-]{36})/i)?.[1];
    expect(projectId).toBeTruthy();

    await waitForEditorRouteReady(page);

    const { accessToken } = await loginApi(request, email, password);
    const note = await addMelodyQuarterNoteVoice0(request, accessToken, projectId as string);
    const song = await fetchProjectSong(request, accessToken, projectId as string);

    await page.reload();
    await waitForEditorRouteReady(page);

    const zoomReadout = page.getByTestId('vybpad-zoom-readout');
    await expect(zoomReadout).toBeVisible();
    await page.getByTestId('vybpad-zoom-in').click();
    await page.getByTestId('vybpad-zoom-in').click();

    const readoutText = (await zoomReadout.innerText()).trim();
    const zoom = parseZoomPercent(readoutText);
    expect(zoom).toBeGreaterThan(1.01);

    const viewport = viewportFromReadout(zoom);
    const { startX, startY } = noteDragPointerPositions(song, viewport, note);

    const canvas = page.getByRole('application', { name: /Song editor/i });
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box, 'canvas bounding box').toBeTruthy();

    const minSumBefore = await minRgbSumNearCanvasPoint(page, '[aria-label^="Song editor"]', startX, startY, 10);
    /** Cleared/unpainted buffer reads ~0; full white flash ~765; PAT-010 note fill typically mid-range. */
    expect(minSumBefore).toBeGreaterThan(120);
    expect(minSumBefore).toBeLessThan(750);

    const pageX = box!.x + startX;
    const pageY = box!.y + startY;
    await page.mouse.move(pageX, pageY);
    await page.mouse.down();
    for (let step = 1; step <= 4; step += 1) {
      await page.mouse.move(pageX + (72 * step) / 4, pageY);
      await expect(zoomReadout).toHaveText(readoutText);
    }
    await page.mouse.up();

    await expect(zoomReadout).toHaveText(readoutText);

    const minSumAfter = await minRgbSumNearCanvasPoint(page, '[aria-label^="Song editor"]', startX, startY, 10);
    expect(minSumAfter).toBeGreaterThan(120);
    expect(minSumAfter).toBeLessThan(750);

    const afterBox = await canvas.boundingBox();
    expect(afterBox!.width).toBeGreaterThan(200);
    expect(afterBox!.height).toBeGreaterThan(200);
  });
});
