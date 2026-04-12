# PM STATE — vYbpad

> PM continuity handoff — **not** a duplicate of `TASK_STATUS.md`. Updated **2026-04-12** — TASKS-2.7 through 2.10 ALL MERGED. TASK-2.9 (#18) merged after Architect (Meridian) INTERFACES.md resolution + rebase conflict fix. `develop` = `5f94560`, 378 tests. **Wave B active:** TASK-2.11 + 2.13 Builder+QA ∥ TASK-2.14 + 2.15 QA — all spawned. TASK-2.12 queued behind 2.11.

---

## Architect direction — execution ownership (2026-04-12)

**You (PM) own the full pipeline.** Current PM instance: **Tempo** (2026-04-12).

**develop tip:** `a0ad185` — TASK-2.7 merged (PR #14). Next milestone: TASK-2.8 + TASK-2.10 merge → TASK-2.9 → TASK-2.11.

**Remaining Phase 2 sequence:** 2.8 ∥ 2.10 → 2.9 → 2.11 → 2.12 ∥ 2.13 → 2.14 ∥ 2.15.

---

## Remote & tip

- **GitHub:** https://github.com/quickthom/vybpad — `origin`, default **`develop`**.
- **`develop` HEAD:** `1fe2334` — TASK-2.6 landed; pull **`git fetch origin`** before acting; run **`npm install`** at repo root (and per worktree) before tests.
- **Merged PRs:** [#9](https://github.com/quickthom/vybpad/pull/9) TASK-2.2 · [#8](https://github.com/quickthom/vybpad/pull/8) TASK-2.1

---

## Phase 2 — wave 1 (done)

| Task | PR | Status |
|------|-----|--------|
| TASK-2.1 | [#8](https://github.com/quickthom/vybpad/pull/8) | merged |
| TASK-2.2 | [#9](https://github.com/quickthom/vybpad/pull/9) | merged |

**Worktrees:** Retire `/home/thom/py/vYbpad-worktrees/phase-2-song-store` and `phase-2-layout-engine` when convenient (`git worktree remove` after switching away). Remote feature branches deleted on merge; local may persist.

**Note:** `phase-2-ui-store` — still **do not start** TASK-2.11 until deps met.

---

## Next actions (pipeline) — updated 2026-04-12 (Tempo/PM)

**All completed this PM session:**
1. ✅ TASK-2.7 merged (PR #14, `a0ad185`, 335 tests)
2. ✅ TASK-2.8 merged (PR #16, `a70f2da`, 368 tests)
3. ✅ TASK-2.10 merged (PR #15, `131f421`, 368 tests)
4. ⛔ TASK-2.9 BLOCKED (PR #18 open, `phase-2/entry-modes`) — Builder added `getSongAfterMutation?` + `onToggleEntryMode?` to EditorCanvasProps without ⛔ flag. Escalated to Architect in `HITL_NOTIFICATIONS.md`. All 378 tests pass; logic is sound.
5. ✅ All stale worktrees removed. Active: `task-2-9-entry-modes` only.
6. `develop` = `a70f2da`, 368 tests passing.

**When Architect resolves TASK-2.9:**
- Likely answer: use `useSongStore()` in keyboard hook directly (no prop needed); toggle via existing `entryMode` state setter passed as prop or read from App context.
- Re-brief Builder to remove the two non-standard props → revise PR #18 → Reviewer → Integrator → TASK-2.11.

**Parallelizable NOW (no TASK-2.9/2.11 dep):**
- TASK-2.12 (guide tone overlay): deps 1A.6 ✓, 2.5 ✓ → safe
- TASK-2.13 (color scheme): deps 2.4 ✓, 2.5 ✓ → safe (parallel with 2.12)
- TASK-2.14 (canvas renderer tests QA): deps 2.3–2.5 ✓ → safe
- TASK-2.15 (song store tests QA): dep 2.1 ✓ → safe

**TASK-2.11 (ui-store):** blocked until 2.9 merges. Branch `phase-2/ui-store` TBD.

---

## Issued briefs — Wave 1 (copy to Builder / QA agents)

### TASK-2.1 — Builder

```
TASK BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.1
Branch:        phase-2/song-store
Assigned to:   Builder
Status:        in-progress

Objective:
  Implement the client Zustand song store matching INTERFACES.md `SongStore`, with Immer for immutable updates and history middleware for undo/redo.

Files expected to be created or modified:
  - client/package.json: add `zustand`, `immer`, and (if used) `zustand/middleware` history — per ARCHITECTURE.md state stack.
  - client/src/store/songStore.ts (or equivalent path under store/): SongStore implementation + exports.
  - client/src/store/index.ts (optional barrel): re-exports if project pattern uses it.

Acceptance criteria:
  1. The public API matches `interface SongStore` in INTERFACES.md § "Zustand Store Shape" — all fields and methods (`song`, `isDirty`, `editChord`, `editNote`, `setMeasureChanges`, `addMeasures`, `deleteMeasures`, `updateMetadata`, `updateBandConfig`, `loadSong`, `undo`, `redo`, `canUndo`, `canRedo`).
  2. Initial `song` matches INTERFACES.md Default Song Factory: **8 empty measures**, correct `bandConfig` and `metadata` shape; use browser `crypto.randomUUID()` for measure `id` values (mirror server `buildDefaultSong` semantics — do not import Node server code into client).
  3. Mutations update nested `SongData` immutably; each user-facing mutation pushes an undo snapshot; `undo`/`redo` restore prior `song` and keep `canUndo`/`canRedo` accurate.
  4. `loadSong` replaces `song`; document in PR: whether undo history clears (recommended: clear stack on load) and set `isDirty` appropriately.
  5. `npm test` from repo root (or client package) passes including new unit tests from QA.

Dependencies:
  TASK-0.4 (merged)

Interfaces this task consumes (from INTERFACES.md):
  - `SongData`, `SongMetadata`, `Measure`, `MeasureChanges`, `BandConfig`, `ChordEvent`, `NoteEvent`, `ChordEditAction`, `NoteEditAction` — data model and edit actions sections.
  - `SongStore` interface — Zustand Store Shape section.

UX guidelines this task must follow (from UX_GUIDELINES.md):
  N/A — no React UI in this task (store module only).

Patterns to apply (from PATTERNS.md):
  - PAT-014: unit tests under `client/tests/unit/store/`.
  - PAT-016: import types from `@vybpad/shared`.
  - PAT-015: branch `phase-2/song-store`, PR to `develop`.

Spark flag:
  Spark not appropriate for this task — core state and undo semantics need careful review.

Working directory: /home/thom/py/vYbpad-worktrees/phase-2-song-store
Branch is already checked out there. Run `npm install` at repo root of that worktree before dev/test.
Read ARCHITECTURE.md, INTERFACES.md, PATTERNS.md, and .cursor/agents/Builder.md before coding.
──────────────────────────────────────────────
```

### TASK-2.1 — QA (concurrent)

```
QA BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.1
Branch:        phase-2/song-store
Assigned to:   QA / Test Writer

This brief is concurrent with the Builder brief for TASK-2.1.
Commit tests to branch phase-2/song-store; confirm they fail before implementation lands.

Acceptance criteria to test against:
  (Same five items as Builder brief TASK-2.1.)

Interfaces to test against (from INTERFACES.md):
  `SongStore` and related types as in Builder brief.

Branch strategy: Check out phase-2/song-store, add `client/tests/unit/store/songStore.test.ts` (or mirror source path per PAT-014), commit failing tests, notify PM / Builder.

When done, send a STATUS_UPDATE to the PM.
──────────────────────────────────────────────
```

### TASK-2.2 — Builder

```
TASK BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.2
Branch:        phase-2/layout-engine
Assigned to:   Builder
Status:        in-progress

Objective:
  Add a pure TypeScript canvas **layout engine**: map musical time (ticks, measures, meter) to horizontal pixels and scale degrees (and chromatic offsets per PAT-018) to vertical pixels, using viewport and PAT-012 constants.

Files expected to be created or modified:
  - client/src/engine/renderer/layout.ts (or `layout/` module): pure functions — tick↔pixel, measure index↔range, pitch row↔Y, zoom applied to `BEAT_WIDTH`.
  - Optional: `client/src/engine/renderer/tickUtils.ts` — TPQN, measure length helpers (pre-authorized in PATTERNS.md timing section).

Acceptance criteria:
  1. Exports documented pure functions with no React/DOM imports; inputs include `SongData` or measure list + `Viewport` from INTERFACES.md `EditorCanvas` props where needed, `zoom` from `Viewport`, and PAT-012 base dimensions scaled by zoom for horizontal spacing.
  2. Time math uses **48 TPQN** and measure length from meter per ARCHITECTURE.md / PATTERNS.md (same formula as server/theory).
  3. Vertical layout: chord staff height vs note rows use PAT-012 `CHORD_AREA_HEIGHT`, `NOTE_HEIGHT`; chromatic vertical offset may follow PAT-018 where relevant for Y helpers.
  4. Unit tests in `client/tests/unit/engine/renderer/` (PAT-014) cover at least: 4/4 measure width in pixels at zoom 1.0 and 2.0; tick inside measure → x; boundary at measure joins.
  5. `npm test` passes with QA tests.

Dependencies:
  TASK-0.4 (merged)

Interfaces this task consumes (from INTERFACES.md):
  - `Viewport`, `SongData`, `TimeSignature` / measure structure — for extent and conversion helpers.

UX guidelines this task must follow (from UX_GUIDELINES.md):
  §6 Canvas-specific conventions / PAT-012 numeric alignment for pixel constants (authoritative numbers in PATTERNS.md PAT-012 unless UX overrides).

Patterns to apply (from PATTERNS.md):
  - PAT-012: Canvas Rendering Constants.
  - PAT-014: test file location under renderer.
  - PAT-015: branch naming.

Spark flag:
  Spark not appropriate — geometry and contracts must match INTERFACES/PAT-012 exactly.

Working directory: /home/thom/py/vYbpad-worktrees/phase-2-layout-engine
Branch checked out; run `npm install` at worktree root before dev/test.
Read ARCHITECTURE.md, INTERFACES.md, PATTERNS.md, and .cursor/agents/Builder.md before coding.
──────────────────────────────────────────────
```

### TASK-2.2 — QA (concurrent)

```
QA BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.2
Branch:        phase-2/layout-engine
Assigned to:   QA / Test Writer

Concurrent with Builder TASK-2.2; tests on phase-2/layout-engine branch; fail before implementation.

Acceptance criteria to test against:
  (Same five items as Builder brief TASK-2.2.)

Interfaces to test against (from INTERFACES.md):
  `Viewport`; `SongData` / meter for measure length.

When done, send a STATUS_UPDATE to the PM.
──────────────────────────────────────────────
```

---

## Issued briefs — Wave 2 (2026-04-12)

**Parallelism:** Three concurrent Builders + QA on **TASK-2.3**, **TASK-2.4**, **TASK-2.5** (separate PAT-017 worktrees). **TASK-2.6** brief included below as **queued** — same `client/src/engine/renderer/index.ts` hotspot would make a fourth parallel branch high-conflict; spawn after Wave 2a PRs merge or Integrator serializes.

**File-scope note:** Each of 2.3–2.5 adds a new module under `client/src/engine/renderer/` and appends `export * from './…'` to `index.ts`. Expect trivial merge conflicts on `index.ts`; resolve by keeping all three exports.

---

### TASK-2.3 — Builder

```
TASK BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.3
Branch:        phase-2/grid-background
Assigned to:   Builder
Status:        in-progress

Objective:
  Implement a pure Canvas2D **grid background** pass: vertical beat subdivisions, measure bar lines, and measure numbers in the header band — driven by `SongData`, `Viewport`, and existing layout helpers (TASK-2.2).

Files expected to be created or modified:
  - client/src/engine/renderer/gridBackground.ts (or equivalent camelCase name): functions that take `CanvasRenderingContext2D` (or accept draw callbacks for testability), `SongData`, `Viewport`, and paint the non-interactive grid layer using PAT-012 colors (`GRID_LINE_COLOR`, `BAR_LINE_COLOR`) and `MEASURE_HEADER_HEIGHT` for the number strip.
  - client/src/engine/renderer/index.ts: append `export * from './<gridModule>';` for the new module.
  - client/tests/unit/engine/renderer/gridBackground.test.ts (mirror source name per PAT-014): mock 2D context or snapshot draw-call order / line positions for representative viewport + meter cases.

Acceptance criteria:
  1. Beat subdivision lines align with `horizontalTicksToPx` / `absoluteTickToViewportX` from `layout.ts` — no duplicate tick math; use `tickUtils` + layout for measure lengths (48 TPQN, PAT-004).
  2. Measure **bar lines** are visually stronger than beat lines (use `BAR_LINE_COLOR` vs `GRID_LINE_COLOR` per PAT-012 / UX §6).
  3. **Measure numbers** render in the header band (`MEASURE_HEADER_HEIGHT`) with typography matching UX_GUIDELINES.md §2 “Measure numbers” (11px, weight 600, color `#374151`) — canvas `font` / `fillStyle` as needed.
  4. Only visible measures per `viewport.startMeasure` and `viewport.measureCount` are drawn; horizontal extent respects `zoom` via existing `BEAT_WIDTH` scaling.
  5. No React imports in the renderer module; `npm test` passes including concurrent QA tests.

Dependencies:
  TASK-2.2 (merged)

Interfaces this task consumes (from INTERFACES.md):
  - `SongData`, `Viewport`, `TimeSignature` / per-measure structure — via layout helpers and `getMeterAtMeasure` / `measureLengthInTicks`.

UX guidelines this task must follow (from UX_GUIDELINES.md):
  - §6 Canvas-specific conventions; grid colors and header height from PAT-012; measure number style from §2 canvas label table.

Patterns to apply (from PATTERNS.md):
  - PAT-012: Canvas Rendering Constants.
  - PAT-014: tests under `client/tests/unit/engine/renderer/`.
  - PAT-015: branch `phase-2/grid-background`.
  - PAT-016: shared types from `@vybpad/shared` where needed.
  - PAT-017: isolated worktree (path below).

Spark flag:
  Spark not appropriate — pixel alignment with layout must be exact.

Working directory: /home/thom/py/vYbpad-worktrees/task-2-3-grid-background
Branch `phase-2/grid-background` is checked out. Run `npm install` at the **repo root** of this worktree before dev/test.
Read ARCHITECTURE.md, INTERFACES.md, PATTERNS.md, UX_GUIDELINES.md (§6), and .cursor/agents/Builder.md before coding.
──────────────────────────────────────────────
```

### TASK-2.3 — QA (concurrent)

```
QA BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.3
Branch:        phase-2/grid-background
Assigned to:   QA / Test Writer

This brief is concurrent with the Builder brief for TASK-2.3.
Commit tests to branch phase-2/grid-background; confirm they fail before implementation lands.

Branch strategy: Check out phase-2/grid-background in worktree `/home/thom/py/vYbpad-worktrees/task-2-3-grid-background`, add failing tests per PAT-014, commit, notify PM/Builder.

Acceptance criteria to test against:
  (Same five items as Builder brief TASK-2.3.)

Interfaces to test against (from INTERFACES.md):
  `SongData`, `Viewport`; layout exports used by the grid.

When done, send a STATUS_UPDATE to the PM.
──────────────────────────────────────────────
```

### TASK-2.4 — Builder

```
TASK BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.4
Branch:        phase-2/chord-block-renderer
Assigned to:   Builder
Status:        in-progress

Objective:
  Implement **chord block** drawing for the canvas layer: rounded rectangles sized by tick duration, filled with PAT-010 degree colors, labeled with Roman numerals (and figured / quality cues as appropriate) using the shared **theoryEngine** — `toRomanNumeral` / `toChordName` per INTERFACES-aligned API.

Files expected to be created or modified:
  - client/src/engine/renderer/chordBlocks.ts: pure drawing helpers (and/or geometry structs) that iterate `Measure.chords` for visible measures, map each chord to viewport X via `layout.ts`, use `chordAreaTopY` / `CHORD_AREA_HEIGHT`, and render per UX §6 “Chord blocks” (6px corner radius, fill opacity, border).
  - client/src/engine/renderer/index.ts: append export for the new module.
  - client/tests/unit/engine/renderer/chordBlocks.test.ts: mock canvas or test pure geometry + label strings from `theoryEngine` for sample `ChordEvent`s.

Acceptance criteria:
  1. Chord block width = tick duration × `pixelsPerTick(zoom)`; vertical placement fills chord strip only (`CHORD_AREA_HEIGHT`).
  2. Fill color follows **PAT-010** for the chord’s effective degree (including borrowed/secondary per `ChordEvent`); label text follows UX §2 / §6 contrast rules (white + subtle shadow when needed).
  3. Roman numeral (and chord naming) comes from `theoryEngine.toRomanNumeral` / `toChordName` with current key+scale from song metadata and measure-level `changes` (use same key/scale resolution pattern as elsewhere in client — inherit per measure).
  4. **Figured bass / inversion / seventh / suspension** hints appear when non-default (document in PR how minimal Roman line vs `toChordName` supplement is split — stay consistent with Hookpad-like readability).
  5. No React in module; `npm test` passes with QA suite.

Dependencies:
  TASK-2.2 (merged), TASK-1A.4 (merged)

Interfaces this task consumes (from INTERFACES.md):
  - `ChordEvent`, `SongData`, `Viewport`, `Measure`; theory labels via `theoryEngine` contract.

UX guidelines this task must follow (from UX_GUIDELINES.md):
  - §6 Chord blocks (geometry, corners, fill, border, text).

Patterns to apply (from PATTERNS.md):
  - PAT-010, PAT-012, PAT-014, PAT-015 (`phase-2/chord-block-renderer`), PAT-016, PAT-017.

Spark flag:
  Spark not appropriate — label + color correctness must match theory engine.

Working directory: /home/thom/py/vYbpad-worktrees/task-2-4-chord-blocks
Branch `phase-2/chord-block-renderer` is checked out. Run `npm install` at repo root of this worktree.
Read ARCHITECTURE.md, INTERFACES.md, PATTERNS.md, UX_GUIDELINES.md §6, and .cursor/agents/Builder.md before coding.
──────────────────────────────────────────────
```

### TASK-2.4 — QA (concurrent)

```
QA BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.4
Branch:        phase-2/chord-block-renderer
Assigned to:   QA / Test Writer

Concurrent with Builder TASK-2.4; tests on phase-2/chord-block-renderer; fail before implementation.

Working directory for checkout: /home/thom/py/vYbpad-worktrees/task-2-4-chord-blocks

Acceptance criteria to test against:
  (Same five items as Builder brief TASK-2.4.)

Interfaces to test against (from INTERFACES.md):
  `ChordEvent`, `SongData`, `Viewport`; `theoryEngine` Roman/chord name outputs.

When done, send a STATUS_UPDATE to the PM.
──────────────────────────────────────────────
```

### TASK-2.5 — Builder

```
TASK BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.5
Branch:        phase-2/note-block-renderer
Assigned to:   Builder
Status:        in-progress

Objective:
  Implement **note block** drawing for melody voices: rounded rects per `NoteEvent`, PAT-010 fills (muted for chromatic), scale-degree numerals, **octave indicators** when `octave !== 0`, and rest styling — using `noteRowY` / PAT-018 from `layout.ts` and `scaleDegreeToMidi` only where needed for validation/debug (primary positioning is layout/Y).

Files expected to be created or modified:
  - client/src/engine/renderer/noteBlocks.ts: draw pass over visible measures and voices (API may take `voiceIndex` or draw all — document); skip or style `isRest` per UX §6.
  - client/src/engine/renderer/index.ts: append export.
  - client/tests/unit/engine/renderer/noteBlocks.test.ts: positions, rest vs note, chromatic offset Y per PAT-018.

Acceptance criteria:
  1. Block height matches UX §6 (`NOTE_HEIGHT - 2px` inset); width from tick duration × `pixelsPerTick(zoom)`.
  2. Vertical position uses `noteRowYFromNoteEvent` / `chromaticYOffset` — chromatic notes sit between diatonic rows per PAT-018.
  3. Degree label + optional octave superscript/subscript per UX “Octave indicator” (`#4B5563` for octave digit).
  4. **Rest** rendering matches UX (hatch or hollow + dashed border).
  5. No React in module; `npm test` passes.

Dependencies:
  TASK-2.2 (merged), TASK-1A.2 (merged)

Interfaces this task consumes (from INTERFACES.md):
  - `NoteEvent`, `SongData`, `Viewport`, `Measure`.

UX guidelines this task must follow (from UX_GUIDELINES.md):
  - §6 Note blocks, octave indicator, rests; PAT-010/017 chromatic muting.

Patterns to apply (from PATTERNS.md):
  - PAT-010, PAT-012, PAT-014, PAT-015 (`phase-2/note-block-renderer`), PAT-016, PAT-017, PAT-018.

Spark flag:
  Spark not appropriate.

Working directory: /home/thom/py/vYbpad-worktrees/task-2-5-note-blocks
Branch `phase-2/note-block-renderer` is checked out. Run `npm install` at repo root of this worktree.
Read ARCHITECTURE.md, INTERFACES.md, PATTERNS.md, UX_GUIDELINES.md §6, and .cursor/agents/Builder.md before coding.
──────────────────────────────────────────────
```

### TASK-2.5 — QA (concurrent)

```
QA BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.5
Branch:        phase-2/note-block-renderer
Assigned to:   QA / Test Writer

Concurrent with Builder TASK-2.5; tests on phase-2/note-block-renderer.

Working directory: /home/thom/py/vYbpad-worktrees/task-2-5-note-blocks

Acceptance criteria to test against:
  (Same five items as Builder brief TASK-2.5.)

Interfaces to test against (from INTERFACES.md):
  `NoteEvent`, `SongData`, `Viewport`.

When done, send a STATUS_UPDATE to the PM.
──────────────────────────────────────────────
```

### TASK-2.6 — Builder + QA (queued — spawn after Wave 2a)

```
TASK BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.6
Branch:        phase-2/hit-testing
Assigned to:   Builder
Status:        in-progress (worktree ready — PM unblocked 2026-04-12)

Objective:
  Implement a **hit-testing / spatial index** for the editor canvas: given `(x, y)` in viewport coordinates, return which chord or note (if any) is under the cursor — using the **same geometric model** as the renderers (layout + PAT-012 dimensions). May duplicate rect math in pure functions or share helpers if extracted without circular imports.

Files expected to be created or modified:
  - client/src/engine/renderer/hitTest.ts (or `spatialIndex.ts`): `hitTestChord`, `hitTestNote` (or unified `hitTest` returning discriminated union); build rects from `SongData` + `Viewport` + `scrollY` for notes.
  - client/src/engine/renderer/index.ts: export new module.
  - client/tests/unit/engine/renderer/hitTest.test.ts: overlapping events, measure boundaries, rest/note, chord strip vs note strip.

Acceptance criteria:
  1. Point in chord strip hits chord events in Z-order (later beats / overlapping handled deterministically — document tie-break).
  2. Point in note area resolves to voice + `NoteEvent` using same row math as `noteRowYFromNoteEvent`.
  3. Misses return null / sentinel per exported API (document shape in PR).
  4. No React; pure TypeScript.
  5. `npm test` passes.

Dependencies:
  TASK-2.2 (merged)

Interfaces this task consumes (from INTERFACES.md):
  - `ChordEvent`, `NoteEvent`, `SongData`, `Viewport`, `Selection` (for future — optional input).

UX guidelines this task must follow (from UX_GUIDELINES.md):
  - N/A for pure hit logic (no pixels drawn); align hit regions with §6 block sizes.

Patterns to apply (from PATTERNS.md):
  - PAT-012, PAT-014, PAT-015, PAT-016, PAT-017.

Spark flag:
  Spark not appropriate.

Unblock criteria:
  **Met (2026-04-12).** Worktree: `/home/thom/py/vYbpad-worktrees/task-2-6-hit-testing` — `npm install` already run at repo root of worktree.

Read ARCHITECTURE.md, INTERFACES.md, PATTERNS.md, and .cursor/agents/Builder.md before coding.
──────────────────────────────────────────────
```

```
QA BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.6
Branch:        phase-2/hit-testing
Assigned to:   QA / Test Writer

Concurrent with Builder TASK-2.6 once spawned.

Acceptance criteria to test against:
  (Same five items as Builder brief TASK-2.6.)

Interfaces to test against (from INTERFACES.md):
  `ChordEvent`, `NoteEvent`, `SongData`, `Viewport`.

When done, send a STATUS_UPDATE to the PM.
──────────────────────────────────────────────
```

---

## Issued briefs — TASK-2.7 (2026-04-12)

**PAT-017:** `git worktree add /home/thom/py/vYbpad-worktrees/task-2-7-mouse phase-2/mouse-interaction` from `develop` after `git fetch origin`. Builder runs `npm install` at worktree repo root before tests.

### TASK-2.7 — Builder

```
TASK BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.7
Branch:        phase-2/mouse-interaction
Assigned to:   Builder
Status:        in-progress

Objective:
  Implement **mouse interaction** on the grid editor: pointer hit-testing via `hitTestEditorCanvas`, click to select chord or note, drag to move and resize (pixel deltas mapped to tick / duration / scale-degree row using the layout engine), with `Selection` and `Viewport` state wired through props; dispatch edits to `SongStore` through `onChordEdit` / `onNoteEdit`.

Files expected to be created or modified:
  - `client/src/components/EditorCanvas.tsx` (or equivalent path under `client/src/components/`): React canvas host implementing `EditorCanvasProps` from INTERFACES.md — `ref` canvas, coordinate transform from client/DOM space to viewport `(x,y)` consistent with `hitTestEditorCanvas` and layout (`absoluteTickToViewportX`, `noteBlocks` / chord rects).
  - `client/src/App.tsx` (and/or a thin editor shell): `useSongStore` — wire `onChordEdit` → `editChord`, `onNoteEdit` → `editNote`; pass `song`, stub or minimal `playbackTick`, `activeVoice`, `entryMode`, `showGuides`, `colorScheme` per props until later tasks.
  - Optional: `client/src/editor/` or `client/src/components/editor/` helper module for pointer state machine (down / move / up, drag threshold) if it keeps the component readable — **must** still satisfy `EditorCanvasProps` at the boundary.
  - `client/tests/unit/...` and/or `client/tests/...` per QA brief (PAT-014 locations as applicable).

Acceptance criteria:
  1. **Hit test:** Uses exported `hitTestEditorCanvas` from `client/src/engine/renderer/hitTest.ts` (re-exported via renderer barrel) with `(x,y)` in the same coordinate space as layout + renderers (document the transform from `PointerEvent` + canvas bounds in the PR).
  2. **Click → selection:** On primary click over a chord or note hit, `onSelectionChange` receives a `Selection` value matching INTERFACES.md (`type: "chord" | "note"`, `measureIndex`, `eventIds` containing the hit event’s `id`). Click on empty canvas (miss) clears selection via `onSelectionChange(null)` or documented alternative — PR must state the rule.
  3. **Drag move:** With a chord or note selected, dragging maps horizontal pixel delta to tick/`beat` changes using `layout` helpers (e.g. `horizontalPxToTicks`, `viewportXToAbsoluteTick`, measure-local clamping per PAT-004) and dispatches `ChordEditAction` `{ type: "move", … }` or `NoteEditAction` `{ type: "move", … }` with valid `newBeat` (and vertical move for notes: `newScaleDegree` / `newOctave` / `chromatic` per row math inverse consistent with `noteRowY` / PAT-018 — document rounding).
  4. **Drag resize:** Horizontal resize (e.g. trailing edge) maps pixel delta to duration ticks and dispatches `resize` actions with `newDuration`; clamp so events stay within measure length and remain valid (positive duration).
  5. **Store:** `onChordEdit` / `onNoteEdit` are wired to Zustand `SongStore.editChord` / `editNote` so mutations participate in undo/redo; after edits, canvas reflects updated `song` from store.
  6. **Viewport / selection storage (until TASK-2.11):** `viewport` and `selection` may live in React component state or a small local module — **must** match INTERFACES.md `Viewport` and `Selection | null`; PR documents which approach and how `onViewportChange` / `onSelectionChange` are used.
  7. `npm test` passes including QA-committed tests.

Dependencies:
  TASK-2.1 (merged), TASK-2.6 (merged)

Interfaces this task consumes (from INTERFACES.md):
  - `EditorCanvasProps`, `Viewport`, `Selection`
  - `ChordEditAction`, `NoteEditAction`
  - `SongStore` — `editChord`, `editNote` (and fields needed to read `song`)

UX guidelines this task must follow (from UX_GUIDELINES.md):
  - §6 **Selection** — fill `SELECTION_COLOR`, outline 1px `#2563EB` (or 80% opacity); §6 **Hover** — hovered event outline or luminance (minimal implementation acceptable if documented).
  - §8 **Drag affordances** — draggable blocks: cursor `grab`; while dragging `grabbing`.

Patterns to apply (from PATTERNS.md):
  - PAT-004: tick arithmetic and measure bounds.
  - PAT-012: canvas metrics alignment with layout/renderer.
  - PAT-014: tests under `client/tests/...` per project conventions.
  - PAT-015: branch `phase-2/mouse-interaction`.
  - PAT-016: shared types from `@vybpad/shared`.
  - PAT-017: isolated worktree — `working_directory` below.

Spark flag:
  Spark not appropriate — pointer coordination and layout inverse math need careful review.

Working directory: /home/thom/py/vYbpad-worktrees/task-2-7-mouse
Branch `phase-2/mouse-interaction` must be checked out there (create worktree from `develop` if not present). Run `npm install` at the **repo root** of this worktree before dev/test.
Read ARCHITECTURE.md, INTERFACES.md, PATTERNS.md, UX_GUIDELINES.md (§6–§8), and `.cursor/agents/Builder.md` before coding.
──────────────────────────────────────────────
```

### TASK-2.7 — QA (concurrent)

```
QA BRIEF
──────────────────────────────────────────────
Task ID:       TASK-2.7
Branch:        phase-2/mouse-interaction
Assigned to:   QA / Test Writer

This brief is concurrent with the Builder brief for TASK-2.7.
The Builder is implementing the feature described below.
Your job is to write a failing test suite against the acceptance criteria
and interface contracts before the Builder's PR lands.

Branch strategy:
  Commit your tests to the Builder's feature branch, not a separate QA branch. Check out `phase-2/mouse-interaction`, write your tests, confirm they fail, and commit. The Builder will implement against your failing tests on the same branch. Tests and implementation will land together in the Builder's PR.

Working directory: /home/thom/py/vYbpad-worktrees/task-2-7-mouse (after PM creates worktree from `develop`)

Acceptance criteria to test against:
  (Same seven items as Builder brief TASK-2.7.)

Interfaces to test against (from INTERFACES.md):
  - `EditorCanvasProps`, `Viewport`, `Selection`, `ChordEditAction`, `NoteEditAction`
  - `SongStore` — `editChord`, `editNote`
  - Renderer: `hitTestEditorCanvas` and `EditorCanvasHit` from `hitTest` (exported via renderer barrel)

Your tests must be committed and failing before the Builder raises their PR.
When done, send a STATUS_UPDATE to the PM.
──────────────────────────────────────────────
```

---

## Queued — TASK-2.7+ (remaining; do not start TASK-2.11)

| Task | ROADMAP deps | Objective (one line) |
|------|----------------|----------------------|
| **TASK-2.7** | 2.1, **2.6** | *(briefs issued 2026-04-12 — see **Issued briefs — TASK-2.7** above)* |
| **TASK-2.8** | 2.1 | Keyboard: scale degrees, duration, delete, arrows — per UX/Hookpad parity. |
| **TASK-2.9** | 2.8 | Entry modes (table vs text). |
| **TASK-2.10** | 2.1 | Measure bar: add/delete measures, selection. |

**TASK-2.11 (ui-store):** blocked until **2.1–2.10** ROADMAP deps satisfied — no branch until then.

---

## Phase 1 — landed (reference)

Squash-merged PRs through **TASK-1B.6**; see `TASK_STATUS.md` for PR index.

---

## Worktree hygiene (PAT-017)

Main worktree: **`/home/thom/py/vYbpad`** — stay on **`develop`**. Retire Phase 2 worktrees after PR merges: `git worktree remove <path>`.

---

## Optional follow-ups (non-blocking)

- **#5 / #7:** Reviewer notes in prior PRs (theory import facade; API tests).

---

## Process notes

- **QA** concurrent with every Builder brief.
- **PAT-019:** `yay` for system packages in agent shells when needed.
- **HITL:** Checkpoint end of Phase 2; routine work does not require Thom.
