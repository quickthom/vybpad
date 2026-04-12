# TASK STATUS — vYbpad

> Single source of truth for build state. Owned by the Project Manager. Updated on every state change.

**`develop` tip:** `e9817f4` — https://github.com/quickthom/vybpad (Wave 2a PR links in TASK_STATUS + HITL).

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

**Authorized:** ROADMAP 2.1–2.15. **Wave 1 merged:** TASK-2.1 (#8), TASK-2.2 (#9). **Wave 2 briefed (2026-04-12):** TASK-2.3, TASK-2.4, TASK-2.5 — parallel worktrees + concurrent QA; **TASK-2.6** queued (see below). **Do not start TASK-2.11** until ROADMAP deps for 2.1–2.10 are satisfied.

### TASK-2.1: Zustand song store (mutations, undo/redo)

- **Assigned role:** Builder + QA → Integrator (done)
- **Branch:** `phase-2/song-store` (merged; remote branch delete may fail until worktree removed)
- **Status:** merged
- **PR:** https://github.com/quickthom/vybpad/pull/8
- **Squash on develop:** `11bba21929e86e5a72c883d15d2bbd8455926975`
- **Tests:** `npm test` — 19 files, 289 passed on merged `develop` (after `npm install` at repo root)
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

- **Assigned role:** Builder + QA (concurrent) → Reviewer
- **Branch:** `phase-2/grid-background`
- **Worktree:** `/home/thom/py/vYbpad-worktrees/task-2-3-grid-background`
- **Status:** in-review
- **PR:** https://github.com/quickthom/vybpad/pull/10
- **Depends on:** TASK-2.2 (merged)
- **Blocking notes:** none
- **Last updated:** 2026-04-12: PR #10 opened (grid background + tests).

### TASK-2.4: Chord block renderer (Roman labels, fills, figured bass)

- **Assigned role:** Builder + QA (concurrent) → Reviewer
- **Branch:** `phase-2/chord-block-renderer`
- **Worktree:** `/home/thom/py/vYbpad-worktrees/task-2-4-chord-blocks`
- **Status:** in-review
- **PR:** https://github.com/quickthom/vybpad/pull/12
- **Depends on:** TASK-2.2 (merged), TASK-1A.4 (merged)
- **Blocking notes:** none
- **Last updated:** 2026-04-12: PR #12 opened.

### TASK-2.5: Note block renderer (colored blocks, octave indicators)

- **Assigned role:** Builder + QA (concurrent) → Reviewer
- **Branch:** `phase-2/note-block-renderer`
- **Worktree:** `/home/thom/py/vYbpad-worktrees/task-2-5-note-blocks`
- **Status:** in-review
- **PR:** https://github.com/quickthom/vybpad/pull/11
- **Depends on:** TASK-2.2 (merged), TASK-1A.2 (merged)
- **Blocking notes:** none
- **Last updated:** 2026-04-12: PR #11 opened.

### TASK-2.6: Hit testing system (spatial index from rendered rects)

- **Assigned role:** Builder + QA (pending spawn)
- **Branch:** `phase-2/hit-testing` (create when unblocked)
- **Worktree:** _not created yet — avoids 4th concurrent barrel edit on `renderer/index.ts`_
- **Status:** blocked
- **Depends on:** TASK-2.2 (merged)
- **Blocking notes:** ROADMAP allows parallel with 2.4/2.5, but Wave 2 caps at **three** parallel worktrees (PAT-017) because **TASK-2.3–2.5** all extend `client/src/engine/renderer/index.ts`. Spawn Builder + QA for 2.6 after Wave 2a PRs merge to `develop` (or after Integrator defines merge order and first PR lands). Full brief in `PM_STATE.md` (Issued briefs — Wave 2 — TASK-2.6 queued).
- **Last updated:** 2026-04-12: Brief text ready; worktree/branch deferred.

---

## Phases 3–8

**Phase 2** in progress — Wave 2a: TASK-2.3–2.5 in flight; TASK-2.6 queued. TASK-2.11 remains **not started** until 2.1–2.10 deps met.
