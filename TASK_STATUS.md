# TASK STATUS — vYbpad

> Single source of truth for build state. Owned by the Project Manager. Updated on every state change.

**`develop` tip:** `7b70fff` — https://github.com/quickthom/vybpad (TASK-2.11/2.13/2.14/2.15 merged 2026-04-12; 440 tests green). **TASK-2.12** (guide tone overlay) is in progress on `phase-2/guide-tones`. Sync: `git fetch origin && npm install`.
**Worktree hygiene:** 14 stale Phase 1/2 worktrees removed 2026-04-12. Active worktrees: main (`develop`) + `task-2-8-keyboard` + `task-2-10-measure-bar` (retire after confirmation).

---

## Phase 0 — Foundation (COMPLETE)

All Phase 0 tasks merged to develop.

| Task | Status | Commit |
|---|---|---|
| TASK-0.1: Project scaffolding | merged | 301e366 |
| TASK-0.2: Client scaffold | merged | 574b5cd |
| TASK-0.3: Server scaffold | merged | 2948b72 |
| TASK-0.4: Shared types | merged | af399d7 |
| TASK-0.5: Docker Compose | merged | 3598985 |
| TASK-0.6: Prisma schema | merged | da8d40c |
| TASK-0.7: UX Guidelines | merged | 5188bce |

---

## Phase 1A — Music Theory Engine

### TASK-1A.1: Scale definitions

- **Status:** merged
- **Last updated:** 2026-04-12: on develop (8e3dd3f ancestry).

### TASK-1A.2: scaleDegreeToMidi

- **Status:** merged

### TASK-1A.3: Chord construction

- **Status:** merged

### TASK-1A.4: Roman numeral generation

- **Assigned role:** Integrator (done)
- **Branch:** phase-1a/roman-numerals (merged; remote branch deleted)
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/2
- **Last updated:** 2026-04-12: Squash-merged to develop as `45f3224`. Reviewer re-approved after GitHub raise-pr body.

### TASK-1A.5: Borrowed chord + secondary chord logic

- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/3
- **Last updated:** 2026-04-12: Merged to develop as `01e95df`. Reviewer re-approved.

### TASK-1A.6: Guide tone classification

- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/4
- **Last updated:** 2026-04-12: Fix for borrowed **iv** tie-break merged as `ad18882`.

### TASK-1A.7: Theory unit tests (comprehensive)

- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/5
- **Last updated:** 2026-04-12: Squash-merged to develop as `8e2a3c0` (`theoryEngine` facade + contract tests). Reviewer approved; minor follow-up: QA file may import facade per review warning (non-blocking).

---

## Phase 1B — Auth & API Layer

### TASK-1B.1: Auth routes

- **Status:** merged

### TASK-1B.2: Auth middleware

- **Status:** merged

### TASK-1B.3: Project CRUD routes

- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/1
- **Last updated:** 2026-04-12: Squash-merged to develop as `16c96d1` (after prior `6f6ad9f` docs). Reviewer-approved; Integrator merged.

### TASK-1B.4: Default song factory

- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/6
- **Last updated:** 2026-04-12: Squash-merged to develop as `ffc89af` (`defaultSongFactory.ts` + tests).

### TASK-1B.5: API client module

- **Status:** merged

### TASK-1B.6: API integration tests

- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/7
- **Last updated:** 2026-04-12: Squash-merged to develop as `a8cf52a`. Reviewer approved (warnings: optional deeper bandConfig assertions / cross-user 404).

---

## Phase 2 — Grid Editor & Song State

**Authorized:** ROADMAP 2.1–2.15. **All of TASK-2.1–2.10 merged** (#8–#18, 2026-04-12). **TASK-2.11 UNBLOCKED** — spawn Builder + QA now. After 2.11, Phase 2 milestone complete → Phase 3 (Persistence).

### TASK-2.1: Zustand song store (mutations, undo/redo)

- **Assigned role:** Builder + QA → Integrator (done)
- **Branch:** `phase-2/song-store` (merged)
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/8
- **Squash on develop:** `11bba21`
- **Depends on:** TASK-0.4 (merged)
- **Last updated:** 2026-04-12: Squash-merged to `develop`.

### TASK-2.2: Canvas layout engine (tick→pixel, pitch→pixel, viewport)

- **Assigned role:** Builder + QA → Integrator (done)
- **Branch:** `phase-2/layout-engine` (merged)
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/9
- **Squash on develop:** `0b10348`
- **Depends on:** TASK-0.4 (merged)
- **Last updated:** 2026-04-12: Squash-merged to `develop`.

### TASK-2.3: Grid background renderer (beat lines, measure bars, bar numbers)

- **Assigned role:** Builder + QA → Integrator (done)
- **Branch:** `phase-2/grid-background` (merged)
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/10
- **Squash on develop:** `e2dd50e`
- **Depends on:** TASK-2.2 (merged)
- **Last updated:** 2026-04-12: Squash-merged to `develop` (first in Wave 2a sequence).

### TASK-2.4: Chord block renderer (Roman labels, fills, figured bass)

- **Assigned role:** Builder + QA → Integrator (done)
- **Branch:** `phase-2/chord-block-renderer` (merged)
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/12
- **Squash on develop:** `5529cac`
- **Depends on:** TASK-2.2 (merged), TASK-1A.4 (merged)
- **Last updated:** 2026-04-12: Merged after Integrator resolved barrel conflict with TASK-2.3.

### TASK-2.5: Note block renderer (colored blocks, octave indicators)

- **Assigned role:** Builder + QA → Integrator (done)
- **Branch:** `phase-2/note-block-renderer` (merged)
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/11
- **Squash on develop:** `2839513`
- **Depends on:** TASK-2.2 (merged), TASK-1A.2 (merged)
- **Last updated:** 2026-04-12: Merged last in Wave 2a; `index.ts` conflict resolved keeping all renderer exports.

### TASK-2.6: Hit testing system (spatial index from rendered rects)

- **Assigned role:** Builder + QA → Integrator (done)
- **Branch:** `phase-2/hit-testing` (merged; remote deleted)
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/13
- **Squash on develop:** `1fe2334`
- **Depends on:** TASK-2.2 (merged); Wave 2a on `develop` (done)
- **Last updated:** 2026-04-12: Squash-merged to `develop`.

### TASK-2.7: Mouse interaction (click select, drag move/resize, selection)

- **Assigned role:** Builder + QA → Reviewer → Integrator (done)
- **Branch:** `phase-2/mouse-interaction` (merged; remote deleted)
- **Worktree (PAT-017):** `/home/thom/py/vYbpad-worktrees/task-2-7-mouse` — retire when convenient
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/14
- **Squash on develop:** `a0ad185`
- **Depends on:** TASK-2.1 (merged), TASK-2.6 (merged)
- **Tests:** 335 passed on merged develop (24 files)
- **Post-merge notes:** (1) ⚠ hover cursor `grab` (dead code in jsdom — fix tracked); (2) `role="presentation"` fixed to `role="application"` by TASK-2.8 Builder.
- **Last updated:** 2026-04-12: Reviewer APPROVED; Integrator squash-merged.

### TASK-2.8: Keyboard input (1–7 degree entry, duration, delete, arrows)

- **Assigned role:** Builder (Forge) + QA (Rebus) → Reviewer (Meridian) → Builder fix (Clef) → Integrator (PM direct)
- **Branch:** `phase-2/keyboard-input` (merged; remote deleted); hotfix branch `fix/task-2-8-digit-key-update` (merged; deleted)
- **Worktree (PAT-017):** `/home/thom/py/vYbpad-worktrees/task-2-8-keyboard` — retire when convenient
- **Status:** merged ✅ (including hotfix)
- **PR:** https://github.com/quickthom/vybpad/pull/16 (initial); https://github.com/quickthom/vybpad/pull/17 (digit-key hotfix)
- **Squash on develop:** `a70f2da` (initial) + `cb181de` (hotfix: digit keys dispatch `update` not `add`)
- **Depends on:** TASK-2.1 (merged), TASK-2.7 (merged — EditorCanvas extended)
- **Tests:** 27 files, 368 passed on merged develop after hotfix (2026-04-12)
- **Blocking notes:** none — hotfix `cb181de` resolves Reviewer Meridian BLOCKED (AC1: digit keys must update scale degree in-place, not append)
- **Last updated:** 2026-04-12: Hotfix PR #17 squash-merged (`cb181de`); all 368 tests green. TASK-2.8 fully resolved.

### TASK-2.9: Entry modes (table vs text)

- **Assigned role:** Builder + QA → Reviewer (blocked) → Architect (Meridian, INTERFACES.md `d3bd016`) → rebase + conflict resolve → Integrator (PM direct)
- **Branch:** `phase-2/entry-modes` (merged; remote deleted)
- **Worktree (PAT-017):** `/home/thom/py/vYbpad-worktrees/task-2-9-entry-modes` — retire when convenient
- **Status:** merged ✅
- **PR:** https://github.com/quickthom/vybpad/pull/18
- **Squash on develop:** `433266f`
- **Depends on:** TASK-2.8 (merged ✓)
- **Tests:** 28 files, 378 passed on merged develop (2026-04-12)
- **Blocking notes:** none — interface escalation resolved by Architect (Meridian); rebase conflict in `useKeyboard.ts` between TASK-2.8 hotfix and TASK-2.9 entry modes logic resolved (TASK-2.9 supersedes); TASK-2.8 keyboard tests updated for text-mode update semantics
- **Last updated:** 2026-04-12: Merged. Phase 2 milestone: all TASK-2.1 through TASK-2.10 + TASK-2.9 merged. TASK-2.11 now unblocked.

### TASK-2.10: Measure bar component (add/delete measures, selection)

- **Assigned role:** Builder + QA → Reviewer → Integrator (done)
- **Branch:** `phase-2/measure-bar` (merged; remote deleted)
- **Worktree (PAT-017):** `/home/thom/py/vYbpad-worktrees/task-2-10-measure-bar` — retire when convenient
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/15
- **Squash on develop:** `131f421`
- **Depends on:** TASK-2.1 (merged)
- **Tests:** 27 files, 368 passed on merged develop (2026-04-12, shared count with #16)
- **Blocking notes:** none — 2 non-blocking warnings: (1) `measuresPerLine=0` infinite loop guard; (2) `window.addEventListener('pointerup')` cleanup on unmount. Follow-up in TASK-2.9 or polish pass.
- **Last updated:** 2026-04-12: Reviewer APPROVED; squash-merged first in batch with #16 (no conflicts).

### TASK-2.11: UI store (viewport, selection, active voice, panels)

- **Assigned role:** Builder + QA → Reviewer (Refrain, APPROVED) → Integrator (PM direct)
- **Branch:** `phase-2/ui-store` (merged; remote deleted)
- **Worktree (PAT-017):** `/home/thom/py/vYbpad-worktrees/task-2-11-ui-store` — retire when convenient
- **Status:** merged ✅
- **PR:** https://github.com/quickthom/vybpad/pull/20
- **Squash on develop:** `4529fff`
- **Tests:** 392 passed (29 files)
- **Depends on:** TASK-0.2 (merged), TASK-2.1–2.10 (all merged ✓)
- **Blocking notes:** none — `toggleEntryMode()` added to INTERFACES.md by Architect (`06dde3b`)
- **Last updated:** 2026-04-12: Merged. App.tsx now uses useUIStore for all UI state.

### TASK-2.12: Guide tone overlay (chord compatibility highlighting)

- **Assigned role:** not yet started — **BLOCKED ON TASK-2.11** (EditorCanvas wiring conflicts)
- **Branch:** `phase-2/guide-tone-overlay` (not yet created)
- **Status:** queued — waiting for TASK-2.11 to merge
- **Depends on:** TASK-1A.6 (merged ✓), TASK-2.5 (merged ✓); sequence after 2.11 to avoid EditorCanvas conflicts
- **Blocking notes:** spawn after TASK-2.11 merges
- **Last updated:** 2026-04-12: Queued; worktree TBD after 2.11 merges.

### TASK-2.13: Color scheme implementation (diatonic + major-centric)

- **Assigned role:** Builder + QA → PM direct merge (PR #22)
- **Branch:** `phase-2/color-scheme` (merged)
- **Worktree (PAT-017):** `/home/thom/py/vYbpad-worktrees/task-2-13-color-scheme` — retire when convenient
- **Status:** merged ✅
- **PR:** https://github.com/quickthom/vybpad/pull/22
- **Squash on develop:** `7b70fff`
- **Tests:** 440 passed (29 files)
- **Depends on:** TASK-2.4 (merged ✓), TASK-2.5 (merged ✓), TASK-2.11 (merged ✓)
- **Blocking notes:** Rebase conflict resolved via --skip of QA baseline commit.
- **Last updated:** 2026-04-12: Merged. colorMaps.ts created; PAT-010 major-centric color scheme applied.

### TASK-2.14: Canvas renderer tests (mock context, draw call assertions)

- **Assigned role:** QA → PM direct merge (PR #21)
- **Branch:** `phase-2/canvas-renderer-tests` (merged)
- **Worktree (PAT-017):** `/home/thom/py/vYbpad-worktrees/task-2-14-canvas-tests` — retire
- **Status:** merged ✅
- **PR:** https://github.com/quickthom/vybpad/pull/21
- **Squash on develop:** `7e8e9b5`
- **Tests:** (included in 440 total)
- **Depends on:** TASK-2.3–2.5 (all merged ✓)
- **Last updated:** 2026-04-12: Merged. gridBackground, chordBlocks, noteBlocks draw-call assertions added.

### TASK-2.15: Song store tests (mutations, undo/redo)

- **Assigned role:** QA → PM direct merge (PR #19)
- **Branch:** `phase-2/song-store-tests` (merged)
- **Worktree (PAT-017):** `/home/thom/py/vYbpad-worktrees/task-2-15-song-store-tests` — retire
- **Status:** merged ✅
- **PR:** https://github.com/quickthom/vybpad/pull/19
- **Squash on develop:** `0b53846`
- **Tests:** (included in 440 total)
- **Depends on:** TASK-2.1 (merged ✓)
- **Last updated:** 2026-04-12: Merged. songStore.test.ts expanded with comprehensive mutation + undo/redo coverage.

### TASK-2.12: Guide tone overlay (chord compatibility highlighting)

- **Assigned role:** Builder + QA (active)
- **Branch:** `phase-2/guide-tones`
- **Worktree (PAT-017):** `/home/thom/py/vYbpad-worktrees/task-2-12-guide-tones`
- **Status:** in-progress
- **Depends on:** TASK-1A.6 (merged ✓), TASK-2.5 (merged ✓), TASK-2.11 (merged ✓)
- **Blocking notes:** none — all dependencies satisfied
- **Last updated:** 2026-04-12: Tempo resumed PM session, verified briefs/worktree, and launched Builder + QA concurrently.

---

## Phases 3–8

**Wave B complete:** TASK-2.11, 2.13, 2.14, 2.15 all merged to `develop` (440 tests). **TASK-2.12** (guide tone overlay) now unblocked and spawning. After 2.12 merges, Phase 2 milestone complete → Phase 3 (Persistence) can begin.
