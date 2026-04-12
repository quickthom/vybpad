# TASK STATUS — vYbpad

> Single source of truth for build state. Owned by the Project Manager. Updated on every state change.

**`develop` tip:** `1fe2334` — https://github.com/quickthom/vybpad (TASK-2.6 #13 squash-merged 2026-04-12). Sync: `git fetch origin`.

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

**Authorized:** ROADMAP 2.1–2.15. **Wave 1 merged:** TASK-2.1 (#8), TASK-2.2 (#9). **Wave 2a merged (2026-04-12):** TASK-2.3 (#10), TASK-2.4 (#12), TASK-2.5 (#11). **TASK-2.6** merged — PR [#13](https://github.com/quickthom/vybpad/pull/13) squash on `develop` `1fe2334`. **TASK-2.7:** brief issued (PM **2026-04-12** — `PM_STATE.md` **Issued briefs — TASK-2.7**). **Do not start TASK-2.11** until ROADMAP deps for 2.1–2.10 are satisfied.

### TASK-2.1: Zustand song store (mutations, undo/redo)

- **Assigned role:** Builder + QA → Integrator (done)
- **Branch:** `phase-2/song-store` (merged; remote branch delete may fail until worktree removed)
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/8
- **Squash on develop:** `11bba21929e86e5a72c883d15d2bbd8455926975`
- **Tests:** `npm test` — 23 files, 325 passed on merged `develop` after TASK-2.6 (2026-04-12; after `npm install` at repo root)
- **Depends on:** TASK-0.4 (merged)
- **Last updated:** 2026-04-12: Squash-merged to `develop`.

### TASK-2.2: Canvas layout engine (tick→pixel, pitch→pixel, viewport)

- **Assigned role:** Builder + QA → Integrator (done)
- **Branch:** `phase-2/layout-engine` (merged)
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/9
- **Squash on develop:** `0b103482934f28023cd013c7e956a88a6b3ee36d`
- **Tests:** (see TASK-2.1 row — shared suite)
- **Depends on:** TASK-0.4 (merged)
- **Last updated:** 2026-04-12: Squash-merged to `develop` (merged before #8 in history).

### TASK-2.3: Grid background renderer (beat lines, measure bars, bar numbers)

- **Assigned role:** Builder + QA → Integrator (done)
- **Branch:** `phase-2/grid-background` (merged; local worktree may still exist)
- **Worktree:** `/home/thom/py/vYbpad-worktrees/task-2-3-grid-background`
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/10
- **Squash on develop:** `e2dd50e732dca18f682c0601c122b9b12c51b4b2`
- **Depends on:** TASK-2.2 (merged)
- **Blocking notes:** none
- **Last updated:** 2026-04-12: Squash-merged to `develop` (first in Wave 2a sequence).

### TASK-2.4: Chord block renderer (Roman labels, fills, figured bass)

- **Assigned role:** Builder + QA → Integrator (done)
- **Branch:** `phase-2/chord-block-renderer` (merged)
- **Worktree:** `/home/thom/py/vYbpad-worktrees/task-2-4-chord-blocks` (merge commit `3e53f13` pushed to resolve `index.ts` vs `develop`)
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/12
- **Squash on develop:** `5529cac` (feat(renderer): chord blocks)
- **Depends on:** TASK-2.2 (merged), TASK-1A.4 (merged)
- **Blocking notes:** none
- **Last updated:** 2026-04-12: Merged after Integrator resolved barrel conflict with TASK-2.3 (`gridBackground` + `chordBlocks` exports).

### TASK-2.5: Note block renderer (colored blocks, octave indicators)

- **Assigned role:** Builder + QA → Integrator (done)
- **Branch:** `phase-2/note-block-renderer` (merged)
- **Worktree:** `/home/thom/py/vYbpad-worktrees/task-2-5-note-blocks` (merge commit `8335bb3` pushed — full barrel: layout, grid, chord, note)
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/11
- **Squash on develop:** `2839513` (feat(renderer): note blocks)
- **Depends on:** TASK-2.2 (merged), TASK-1A.2 (merged)
- **Blocking notes:** none
- **Last updated:** 2026-04-12: Merged last in sequence #10→#12→#11; `index.ts` conflict resolved keeping all renderer exports.

### TASK-2.6: Hit testing system (spatial index from rendered rects)

- **Assigned role:** Builder + QA → Integrator (done)
- **Branch:** `phase-2/hit-testing` (merged; remote deleted; local branch may persist until worktree removed)
- **Worktree:** `/home/thom/py/vYbpad-worktrees/task-2-6-hit-testing`
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/13
- **Squash on develop:** `1fe233414fb0be549b8cf31b9f20a0bc52d0c6cd`
- **Depends on:** TASK-2.2 (merged); Wave 2a on `develop` (done)
- **Blocking notes:** none
- **Tests:** `npm test` — 23 files, 325 passed on merged `develop` after TASK-2.6 (2026-04-12)
- **Last updated:** 2026-04-12: Squash-merged to `develop` (`gh pr merge` remote branch deleted; local `phase-2/hit-testing` not deleted — in use by worktree).

### TASK-2.7: Mouse interaction (click select, drag move/resize, selection)

- **Assigned role:** Builder + QA (brief issued; not yet spawned)
- **Branch:** `phase-2/mouse-interaction`
- **Worktree (PAT-017):** `/home/thom/py/vYbpad-worktrees/task-2-7-mouse` — create from `develop` per brief
- **Status:** brief-issued
- **Depends on:** TASK-2.1 (merged), TASK-2.6 (merged)
- **Blocking notes:** none
- **Last updated:** 2026-04-12: Full Builder + QA briefs recorded in `PM_STATE.md` section **Issued briefs — TASK-2.7 (2026-04-12)**; spawn when ready.

---

## Phases 3–8

**Phase 2** in progress — Wave 2a **merged** (TASK-2.3–2.5); **TASK-2.6** **merged** ([PR #13](https://github.com/quickthom/vybpad/pull/13), squash `1fe2334`). **TASK-2.7** **brief-issued** — see `PM_STATE.md`. TASK-2.11 remains **not started** until 2.1–2.10 deps met.
