/*
 * QA COVERAGE PLAN — TASK-8.2 (ROADMAP 8.2 — full user workflow E2E)
 *
 * Criterion: register → create project → substantive edit (chord in UI + melody note) → play → export MIDI;
 *            download is non-empty SMF; header matches Standard MIDI File (MThd, Type 1, 480 PPQN).
 *
 * Note on melody entry: table-mode digit entry requires `selection.type === 'note'` for the first melody
 * (`shouldUseNoteEntry` / useKeyboard.ts), but an empty staff click does not establish a note caret
 * (chordStripCaretSelectionFromPointer is chord-strip only; staff miss clears selection). So the first
 * note is merged via PUT like harmony-voicing.task-4-3 / shortcut seeds — chord still comes from the
 * persistence-style UI path (PAT-012 chord strip).
 *
 * INTERFACES.md — MidiExporter.exportSong (Type 1, PPQN 480); TransportControls currentBeat as playback
 * surrogate (TASK-4.10 — no canvas pixel assertions).
 */

import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import type { NoteEvent, SongData } from '@vybpad/shared';

import { parseSmfHeader } from '../helpers/smfTestUtils';
import { EDITOR_CANVAS_PITCH_GUTTER_PX, editorChordStripCenterY } from './helpers/editorCanvasCoords';
import { waitForEditorRouteReady } from './helpers/editorReady';
import { submitRegisterFormAndExpectProjects } from './helpers/registerFlow';
import {
  clickTransportPlayAndAwaitReady,
  getTransportCurrentBeatText,
  getTransportPauseButton,
  getTransportToolbar,
} from './helpers/transport';

const API_BASE = (process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function ensureTableEntryMode(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: /Entry mode (Table|Text)/ });
  await expect(btn).toBeVisible({ timeout: 15_000 });
  const label = await btn.getAttribute('aria-label');
  if (label?.includes('Text')) {
    await btn.click();
    await expect(btn).toHaveAttribute('aria-label', /Entry mode Table/);
  }
}

function editorCanvas(page: Page): Locator {
  return page.getByRole('application', { name: /Song editor/i });
}

async function focusChordStripForDigitEntry(canvas: Locator): Promise<void> {
  const box = await canvas.boundingBox();
  expect(box, 'editor canvas should have a layout box').toBeTruthy();
  const w = box!.width;
  const h = box!.height;
  const g = EDITOR_CANVAS_PITCH_GUTTER_PX;
  const x = Math.min(Math.max(g + 40, g + (w - g) * 0.1), w - 4);
  const y = Math.min(Math.max(28, editorChordStripCenterY(h)), h - 4);
  await canvas.click({ position: { x, y } });
  await expect(canvas).toBeFocused({ timeout: 15_000 });
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

async function fetchProjectSong(request: APIRequestContext, accessToken: string, projectId: string): Promise<SongData> {
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

/**
 * After UI chord(s) autosave, add one quarter-note melody (voice 0) at beat 0 — same persistence shape as
 * midiExporter unit tests (48 ticks).
 */
async function addMelodyQuarterNoteVoice0(
  request: APIRequestContext,
  accessToken: string,
  projectId: string,
): Promise<void> {
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
  m0.notes[0].push(n);
  await putProjectSong(request, accessToken, projectId, song);
}

function songHasAtLeastOneChord(song: SongData): boolean {
  return song.measures.some((m) => (m.chords?.length ?? 0) >= 1);
}

async function readDownloadBytes(download: import('@playwright/test').Download): Promise<Uint8Array> {
  const failure = await download.failure();
  expect(failure, `download failed: ${failure}`).toBeNull();
  const stream = await download.createReadStream();
  expect(stream, 'download stream').toBeTruthy();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new Uint8Array(Buffer.concat(chunks));
}

test.describe('TASK-8.2 — full user workflow (register → edit → play → MIDI export)', () => {
  /** bcrypt register + 90s autosave poll + Web Audio playback need more than default 120s / 180s caps. */
  test.describe.configure({ mode: 'serial', timeout: 420_000 });

  test('register → new project → UI chord + API melody note → play advances readout → Download .mid yields valid SMF Type 1 (480 PPQN)', async ({
    page,
    request,
  }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-workflow-${suffix}@vybpad-e2e.test`;
    const password = 'E2ETestPass-123';
    const displayName = `E2E Workflow ${suffix}`;
    const projectName = `E2E Workflow ${suffix}`;

    await page.goto('/register');
    await page.locator('#register-email').fill(email);
    await page.locator('#register-display-name').fill(displayName);
    await page.locator('#register-password').fill(password);
    await submitRegisterFormAndExpectProjects(page);

    await page.locator('#new-project-name').fill(projectName);
    const createProjectResponse = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes('/api/projects') &&
        !/\/api\/projects\/[0-9a-f-]{36}/i.test(r.url()),
      { timeout: 90_000 },
    );
    await page.getByRole('button', { name: 'Create project' }).click();
    const createdRes = await createProjectResponse;
    expect(createdRes.ok(), await createdRes.text().catch(() => '')).toBeTruthy();
    const created = (await createdRes.json()) as { id: string };
    expect(created.id, 'POST /api/projects should return a project id').toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    await page.waitForURL(new RegExp(`/editor/${created.id}(?:/|[?#]|$)`, 'i'), { timeout: 90_000 });

    const id = created.id;

    await waitForEditorRouteReady(page);
    await ensureTableEntryMode(page);

    const canvas = editorCanvas(page);
    await expect(page.getByRole('button', { name: /^Save$/ })).toBeDisabled({ timeout: 30_000 });
    await page.locator('#transport-tempo-input').blur();

    await focusChordStripForDigitEntry(canvas);
    await page.keyboard.type('1', { delay: 120 });

    await expect(page.getByRole('button', { name: /^Save$/ })).toBeEnabled({ timeout: 30_000 });

    const { accessToken } = await loginApi(request, email, password);
    await expect
      .poll(
        async () => {
          const song = await fetchProjectSong(request, accessToken, id);
          return songHasAtLeastOneChord(song);
        },
        {
          timeout: 90_000,
          intervals: [500, 1_000, 2_000, 4_000],
          message: 'GET /api/projects/:id should show ≥1 chord after autosave',
        },
      )
      .toBe(true);

    await addMelodyQuarterNoteVoice0(request, accessToken, id);

    // Full navigation instead of `reload()` — on some CI hosts Chromium can crash during reload after Web Audio + canvas.
    await page.goto(`/editor/${id}`, { waitUntil: 'domcontentloaded' });
    await waitForEditorRouteReady(page);

    const transport = getTransportToolbar(page);
    await expect(transport).toBeVisible();

    const beatText = getTransportCurrentBeatText(transport);
    await expect(beatText).toBeVisible();
    const initialBeat = (await beatText.innerText()).trim();
    expect(initialBeat).toMatch(/^\d+:\d+$/);

    await clickTransportPlayAndAwaitReady(transport);
    await expect(getTransportPauseButton(transport)).toBeEnabled();

    await expect(async () => {
      const now = (await beatText.innerText()).trim();
      expect(now).toMatch(/^\d+:\d+$/);
      expect(now).not.toBe(initialBeat);
    }).toPass({
      timeout: 30_000,
      intervals: [50, 100, 200, 400],
    });

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('vybpad-midi-export-download').click();
    const download = await downloadPromise;

    const bytes = await readDownloadBytes(download);
    expect(bytes.length, 'exported MIDI must be non-empty').toBeGreaterThan(14);

    expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!), 'SMF magic').toBe('MThd');

    const header = parseSmfHeader(bytes);
    expect(header.format, 'INTERFACES MidiExporter — Type 1').toBe(1);
    expect(header.ticksPerQuarter, 'INTERFACES MidiExporter — 480 PPQN').toBe(480);
    expect(header.numTracks, 'Type 1 — at least conductor + tracks').toBeGreaterThanOrEqual(2);
  });
});
