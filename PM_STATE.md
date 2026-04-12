# PM STATE — vYbpad

> PM continuity handoff — **not** a duplicate of `TASK_STATUS.md`. Updated **2026-04-12** — Phase 2 wave 1 briefed (TASK-2.1 + TASK-2.2).

---

## Remote & tip

- **GitHub:** https://github.com/quickthom/vybpad — `origin`, default **`develop`**.
- **`develop` HEAD:** `648106d` — `docs(pm): align PM_STATE and TASK_STATUS after Phase 1`  
  *(Aligned with `TASK_STATUS.md` tip line after PM sync; `git fetch origin develop` matches.)*

---

## Phase 2 — active parallel wave (2026-04-12)

| Task | Branch | Worktree | `npm install` |
|------|--------|----------|---------------|
| TASK-2.1 | `phase-2/song-store` | `/home/thom/py/vYbpad-worktrees/phase-2-song-store` | done |
| TASK-2.2 | `phase-2/layout-engine` | `/home/thom/py/vYbpad-worktrees/phase-2-layout-engine` | done |

**Spawn status:** Briefs below are ready for **Builder + concurrent QA** sessions. This PM session prepared branches, worktrees, and docs; **open two Builder agents and two QA agents** (or equivalent) with the matching prompts — Cursor Task spawning is not available from this chat context.

**Note:** A third worktree `phase-2-ui-store` on branch `phase-2/ui-store` exists (TASK-2.11 scope per ROADMAP). **Do not start 2.11** until dependencies land; retire or ignore until briefed.

---

## Next actions (pipeline)

1. **Builders** implement TASK-2.1 and TASK-2.2 on the branches above; **QA** commits failing tests on the same branches first (per process).
2. When both PRs are green, **Reviewer** on each PR; then **Integrator** squash-merge to `develop` (order: either merge order OK if no conflicts — prefer **2.2 first** if 2.3 will touch renderer + layout; 2.1 is independent).
3. After merges: `git worktree remove` the two Phase 2 worktrees; re-brief **TASK-2.3** (needs 2.2) and continue **TASK-2.1** parallel work if 2.1 still open (ROADMAP: 2.3 parallel with 2.1 once 2.2 landed).
4. **Designer:** Persistent Designer available for UI-heavy Phase 2 tasks (2.4+); not required for 2.1 / 2.2 (non-UI core modules).

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
