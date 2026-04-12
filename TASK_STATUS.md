# TASK STATUS — vYbpad

> Single source of truth for build state. Owned by the Project Manager. Updated on every state change.

**`develop` tip:** `648106d` — https://github.com/quickthom/vybpad (`docs(pm): align PM_STATE and TASK_STATUS after Phase 1`; code milestone remains Phase 1 merge `a8cf52a` ancestry).

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

**Authorized:** ROADMAP 2.1–2.15. **Parallel wave 1 (active):** TASK-2.1 + TASK-2.2 (isolated worktrees, PAT-017).

### TASK-2.1: Zustand song store (mutations, undo/redo)

- **Assigned role:** Builder + QA (concurrent)
- **Branch:** `phase-2/song-store` (PAT-015)
- **Worktree:** `/home/thom/py/vYbpad-worktrees/phase-2-song-store`
- **Status:** in-progress
- **Depends on:** TASK-0.4 (merged)
- **Blocking notes:** none
- **Last updated:** 2026-04-12: PM brief issued; worktree on `develop` @ `648106d`; `npm install` run in worktree.

### TASK-2.2: Canvas layout engine (tick→pixel, pitch→pixel, viewport)

- **Assigned role:** Builder + QA (concurrent)
- **Branch:** `phase-2/layout-engine` (PAT-015)
- **Worktree:** `/home/thom/py/vYbpad-worktrees/phase-2-layout-engine`
- **Status:** in-progress
- **Depends on:** TASK-0.4 (merged)
- **Blocking notes:** none
- **Last updated:** 2026-04-12: PM brief issued; worktree on `develop` @ `648106d`; `npm install` run in worktree.

---

## Phases 3–8

**Phase 1A + Phase 1B** merged to `develop`. **Phase 2** in progress — see task rows above; next unblocked after merges: TASK-2.3 (needs 2.2), parallel TASK-2.1 with 2.2/2.3 per ROADMAP.
