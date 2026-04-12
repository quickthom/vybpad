# TASK STATUS — vYbpad

> Single source of truth for build state. Owned by the Project Manager. Updated on every state change.

**`develop` tip:** `450bc34` — https://github.com/quickthom/vybpad (TASK-2.1 + TASK-2.2 merged; TASK_STATUS tip fix).

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

**Authorized:** ROADMAP 2.1–2.15. **Wave 1 merged:** TASK-2.1 (#8), TASK-2.2 (#9). **Next unblocked:** TASK-2.3 (needs 2.2 ✓); TASK-2.4 / TASK-2.5 / TASK-2.6 (deps met — see ROADMAP parallel-with).

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

---

## Phases 3–8

**Phase 2** in progress — TASK-2.1 and TASK-2.2 merged; brief TASK-2.3+ per `PM_STATE.md` / ROADMAP.
