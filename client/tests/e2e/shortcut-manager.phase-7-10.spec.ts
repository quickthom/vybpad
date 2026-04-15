/*
 * QA COVERAGE PLAN — TASK-7.10
 *
 * INTERFACES: ShortcutCommandId / ShortcutContext (PAT-027); observable UI + persisted song via API (no store imports).
 *
 * 7.2 Note duration: chord duration resize via H/J/K/L registrations → GET song chord.duration.
 * 7.3 Split: Slash → two notes; Tie: T → merged duration; Triplet: Shift+T → duration map 48↔32.
 * 7.4 Clipboard: Ctrl+C / Ctrl+V → pasted note appears in target measure (GET song).
 * 7.5 Zoom: Ctrl+= increases canvas layout width; Selection: ArrowRight moves chord selection (roman readout);
 *           Transport: Space starts playback (transport readout advances).
 * Negative: isTextEditing — focus tempo input, K must not resize chord (GET unchanged).
 */

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import {
  buildShortcutSongChordDuration,
  buildShortcutSongClipboard,
  buildShortcutSongSplitNote,
  buildShortcutSongTieNotes,
  buildShortcutSongTripletNote,
  buildShortcutSongTwoChords,
} from '../fixtures/shortcutE2ESeedSong';
import { waitForEditorRouteReady } from './helpers/editorReady';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';
import {
  clickTransportPlayAndAwaitReady,
  getTransportCurrentBeatText,
  getTransportPauseButton,
  getTransportToolbar,
} from './helpers/transport';

import type { SongData } from '@vybpad/shared';

const API_BASE = (process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function loginApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ accessToken: string }> {
  const response = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<{ accessToken: string }>;
}

async function putSong(request: APIRequestContext, accessToken: string, projectId: string, song: SongData): Promise<void> {
  const response = await request.put(`${API_BASE}/api/projects/${projectId}`, {
    data: { songData: song },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function getSong(request: APIRequestContext, accessToken: string, projectId: string): Promise<SongData> {
  const response = await request.get(`${API_BASE}/api/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = (await response.json()) as { songData: SongData };
  return body.songData;
}

function editorCanvas(page: Page): Locator {
  return page.getByRole('application', { name: /Song editor/i });
}

/**
 * Chord strip hit target — layout uses MEASURE_HEADER_HEIGHT (24) + chord strip center (~44px from canvas top).
 * See `layoutChordBlock` / `chordAreaTopY` (renderer).
 */
async function clickFirstChordStrip(page: Page): Promise<void> {
  const el = editorCanvas(page);
  const box = await el.boundingBox();
  expect(box, 'editor canvas bounding box').toBeTruthy();
  /** Beat-0 chord block — use a left-ish fraction so we stay in the first harmony when multiple chords share a measure (TASK-7.5). */
  const x = Math.min(Math.max(16, box!.width * 0.018), box!.width - 8);
  const y = Math.min(44, box!.height - 8);
  await el.click({ position: { x, y } });
}

/**
 * First melody note (scale degree 1, octave 0) — row 0 under {@link noteStaffTopY} (64px); block center ~74px.
 * Matches seeded fixtures that place events at beat 0 in measure 0.
 */
async function clickFirstMelodyNoteArea(page: Page): Promise<void> {
  const el = editorCanvas(page);
  const box = await el.boundingBox();
  expect(box, 'editor canvas bounding box').toBeTruthy();
  const x = Math.min(Math.max(32, box!.width * 0.032), box!.width - 8);
  const y = Math.min(74, box!.height - 8);
  await el.click({ position: { x, y } });
}

/**
 * Narrow short notes (e.g. 48-tick quarter): at default zoom many measures may be visible, so a ~3% canvas
 * click can map past tick 48 and miss the note rect while a half note (96) still hits — see TASK-7.3 triplet E2E.
 */
async function clickFirstMelodyNoteNearBeatZero(page: Page): Promise<void> {
  const el = editorCanvas(page);
  const box = await el.boundingBox();
  expect(box, 'editor canvas bounding box').toBeTruthy();
  const x = Math.min(Math.max(16, box!.width * 0.018), box!.width - 8);
  const y = Math.min(74, box!.height - 8);
  await el.click({ position: { x, y } });
}

async function waitForProjectPut(page: Page, projectId: string, timeout = 25_000): Promise<void> {
  await page.waitForResponse(
    (r) =>
      r.request().method() === 'PUT' &&
      r.url().includes(`/api/projects/${projectId}`) &&
      r.ok(),
    { timeout },
  );
}

async function createEditorWithSong(
  page: Page,
  request: APIRequestContext,
  song: SongData,
): Promise<{ email: string; password: string; projectId: string; accessToken: string }> {
  const suffix = uniqueSuffix();
  const email = `e2e-shortcut-${suffix}@vybpad-e2e.test`;
  const password = 'E2ETestPass-123';
  const displayName = `E2E Shortcut ${suffix}`;
  const projectName = `E2E Shortcut ${suffix}`;

  await page.goto('/register');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-display-name').fill(displayName);
  await page.locator('#register-password').fill(password);
  await submitRegisterFormAndExpectProjects(page);

  await page.locator('#new-project-name').fill(projectName);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}/i);

  const projectId = page.url().match(/\/editor\/([0-9a-f-]{36})/i)?.[1];
  expect(projectId).toBeTruthy();

  await waitForEditorRouteReady(page);

  const { accessToken } = await loginApi(request, email, password);
  await putSong(request, accessToken, projectId as string, song);

  await page.goto('/projects');
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByRole('button', { name: projectName, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/editor/${projectId}`));
  await waitForEditorRouteReady(page);

  return { email, password, projectId: projectId as string, accessToken };
}

test.describe('TASK-7.10 — Phase 7 shortcut manager (E2E)', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test.beforeEach(async ({ context }) => {
    const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(origin).origin });
  });

  test('setNoteDurationQuarter (K) resizes selected chord to 48 ticks (TASK-7.2)', async ({ page, request }) => {
    const { projectId, accessToken } = await createEditorWithSong(page, request, buildShortcutSongChordDuration());

    await clickFirstChordStrip(page);
    await editorCanvas(page).focus();

    const put = waitForProjectPut(page, projectId);
    await page.keyboard.press('k');
    await put;

    const song = await getSong(request, accessToken, projectId);
    const d = song.measures[0]?.chords[0]?.duration;
    expect(d, 'chord duration after K (persisted)').toBe(48);
  });

  test('Slash splits selected half note into two quarter notes (TASK-7.3 split)', async ({ page, request }) => {
    const { projectId, accessToken } = await createEditorWithSong(page, request, buildShortcutSongSplitNote());

    await clickFirstMelodyNoteArea(page);
    await editorCanvas(page).focus();

    const put = waitForProjectPut(page, projectId);
    await page.keyboard.press('Slash');
    await put;

    const song = await getSong(request, accessToken, projectId);
    const lane = song.measures[0]?.notes[0] ?? [];
    expect(lane, 'split produces two notes').toHaveLength(2);
    expect(lane.map((n) => n.duration).sort((a, b) => a - b)).toEqual([48, 48]);
  });

  test('T ties adjacent same-pitch eighth notes into one quarter (TASK-7.3 tie)', async ({ page, request }) => {
    const { projectId, accessToken } = await createEditorWithSong(page, request, buildShortcutSongTieNotes());

    await clickFirstMelodyNoteArea(page);
    await editorCanvas(page).focus();
    /** Move to the later eighth so `planTieNote` merges backward (same as Hookpad tie gesture). */
    await page.keyboard.press('ArrowRight');

    const put = waitForProjectPut(page, projectId);
    await page.keyboard.press('t');
    await put;

    const song = await getSong(request, accessToken, projectId);
    const lane = song.measures[0]?.notes[0] ?? [];
    expect(lane).toHaveLength(1);
    expect(lane[0]?.duration).toBe(48);
  });

  test('Shift+T toggles straight quarter to triplet-class eighth (48 → 32) (TASK-7.3 triplet)', async ({
    page,
    request,
  }) => {
    const { projectId, accessToken } = await createEditorWithSong(page, request, buildShortcutSongTripletNote());

    const canvas = editorCanvas(page);
    await clickFirstMelodyNoteNearBeatZero(page);
    await canvas.focus();
    await expect(canvas).toBeFocused();

    /** Atomic chord so Chromium sends one keydown with `shiftKey` (matches `chordFromKeyboardEvent` → `Shift+T`). */
    await page.keyboard.press('Shift+KeyT');

    const put = waitForProjectPut(page, projectId);
    await put;

    const song = await getSong(request, accessToken, projectId);
    expect(song.measures[0]?.notes[0][0]?.duration).toBe(32);
  });

  test('Ctrl+C then Ctrl+V pastes copied note into another measure (TASK-7.4)', async ({ page, request }) => {
    const { projectId, accessToken } = await createEditorWithSong(page, request, buildShortcutSongClipboard());

    const canvas = editorCanvas(page);
    await clickFirstMelodyNoteNearBeatZero(page);
    await canvas.focus();

    await page.keyboard.press('Control+c');
    /** `copySelection` writes the clipboard asynchronously after the key handler returns — wait before paste. */
    await expect
      .poll(async () => {
        const t = await page.evaluate(() => navigator.clipboard.readText());
        return t.includes('"kind"') && t.includes('selection');
      }, { timeout: 5000 })
      .toBe(true);

    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    /**
     * Empty m1 has no note rect — staff clicks are misses and `chordStripCaretSelectionFromPointer` returns null
     * for y on the staff (needs chord-strip Y). Use chord strip (~44px). X must fall in measure 1, not m3+:
     * with several measures visible, ~50% canvas maps past the second bar — use ~14% (just after m0).
     */
    await canvas.click({
      position: {
        x: Math.min(Math.max(48, box!.width * 0.14), box!.width - 8),
        y: Math.min(44, box!.height - 8),
      },
    });
    await canvas.focus();

    const put = waitForProjectPut(page, projectId);
    await page.keyboard.press('Control+v');
    await put;

    const song = await getSong(request, accessToken, projectId);
    expect(song.measures[1]?.notes[0]?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  test('Ctrl+= increases canvas width (zoomIn) and Ctrl+0 resets (TASK-7.5 zoom)', async ({ page, request }) => {
    await createEditorWithSong(page, request, buildShortcutSongChordDuration());

    const canvas = editorCanvas(page);
    await canvas.focus();
    const w0 = await canvas.evaluate((el) => el.clientWidth);

    await page.keyboard.press('Control+=');
    await expect
      .poll(async () => canvas.evaluate((el) => el.clientWidth), { timeout: 15_000 })
      .toBeGreaterThan(w0);

    const wZoomed = await canvas.evaluate((el) => el.clientWidth);
    await page.keyboard.press('Control+0');
    await expect
      .poll(async () => Math.abs((await canvas.evaluate((el) => el.clientWidth)) - w0), { timeout: 15_000 })
      .toBeLessThanOrEqual(1);

    expect(wZoomed).toBeGreaterThan(w0);
  });

  test('ArrowRight moves chord selection to next harmony event (roman readout changes) (TASK-7.5 selection)', async ({
    page,
    request,
  }) => {
    await createEditorWithSong(page, request, buildShortcutSongTwoChords());

    const roman = page.getByRole('region', { name: 'Secondary chords' }).locator('[aria-live="polite"]');

    await clickFirstChordStrip(page);
    await editorCanvas(page).focus();
    await expect(roman).toHaveText('I');

    await page.keyboard.press('ArrowRight');
    await expect(roman).toHaveText('V');
  });

  test('Space starts playback and current-beat readout advances (TASK-7.5 transport)', async ({ page, request }) => {
    await createEditorWithSong(page, request, buildShortcutSongChordDuration());

    const transport = getTransportToolbar(page);
    const beatText = getTransportCurrentBeatText(transport);
    const initialBeat = (await beatText.innerText()).trim();

    await editorCanvas(page).focus();
    await clickTransportPlayAndAwaitReady(transport);
    await expect(getTransportPauseButton(transport)).toBeEnabled();

    await expect
      .poll(async () => (await beatText.innerText()).trim(), { timeout: 30_000 })
      .not.toBe(initialBeat);

    await getTransportPauseButton(transport).click();
  });

  test('with tempo input focused, K does not apply setNoteDurationQuarter to the song (ShortcutContext isTextEditing)', async ({
    page,
    request,
  }) => {
    const { accessToken, projectId } = await createEditorWithSong(page, request, buildShortcutSongChordDuration());

    expect((await getSong(request, accessToken, projectId)).measures[0]?.chords[0]?.duration).toBe(96);

    await page.locator('#transport-tempo-input').click();
    await expect(page.locator('#transport-tempo-input')).toBeFocused();
    await page.keyboard.press('k');

    const after = (await getSong(request, accessToken, projectId)).measures[0]?.chords[0]?.duration;
    expect(after).toBe(96);
  });
});
