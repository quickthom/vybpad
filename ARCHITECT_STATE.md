# ARCHITECT STATE — vYbpad

> Periodically updated cache of the Architect's current state. Review on session resume.

**Last updated:** 2026-04-12 — Phase 2 nearly complete. **14 of 15 tasks merged** (2.1–2.11, 2.13–2.15). **TASK-2.12** (guide tone overlay) is the **sole remaining task** — worktree exists, branch created, but Builder + QA agents were **not yet spawned** (PM interrupted mid-spawn). **Next action:** respawn PM → spawn Builder + QA for TASK-2.12 → merge → Phase 2 milestone complete → HITL checkpoint → Phase 3.

---

## Current Phase

**Phase 2 — 14/15 tasks merged.** Only **TASK-2.12** (guide tone overlay) remains. Phase 0, 1A, and 1B are complete. PM owns task decomposition, briefs, and `TASK_STATUS.md` updates; async handoff in `HITL_NOTIFICATIONS.md`.

## What I (Caden, Architect) Have Done

1. **Research phase complete.** Three research briefs issued and reviewed: Hookpad features/UI, tech stack, internal data model. All findings synthesized into architectural decisions.
2. **All four canonical documents written and committed:**
   - `ARCHITECTURE.md` — stack, data model, auth, infrastructure (incl. GitHub origin), testing strategy
   - `INTERFACES.md` — API contracts, DB schema, song data model, component props, store shapes, engine interfaces
   - `ROADMAP.md` — 9-phase build plan with dependency graph and parallelism map
   - `PATTERNS.md` — 19 pre-authorized patterns (PAT-017 worktrees; PAT-019 `yay` for system packages)
3. **Phase 2 escalations resolved:**
   - TASK-2.9: Added `getSongAfterMutation?` and `onToggleEntryMode?` to `EditorCanvasProps` in `INTERFACES.md` (`d3bd016`)
   - TASK-2.11: Added `UIStore.toggleEntryMode()` to `INTERFACES.md` (`06dde3b`)
   - TASK-2.8 hotfix: Reviewer caught digit keys dispatching `add` instead of `update` — Builder fix merged as PR #17
4. **Process interventions (cumulative):**
   - **GitHub:** canonical remote `https://github.com/quickthom/vybpad`; default branch `develop`; PRs #1–#22 landed
   - PAT-017 (git worktrees), PAT-019 (`yay` for system packages)
   - Role boundary enforcement: Architect does not spawn pipeline agents — PM only
   - QA concurrent with every Builder — enforced after early violation

## Key Decisions Made (for reference on resume)

| Decision | Rationale |
|---|---|
| Scale-degree-first data model | Matches Hookpad's core design; enables free transposition |
| 48 TPQN timing | Clean division for all note values including triplets; scales to 480 PPQN for MIDI |
| Canvas for editor, React for chrome | Performance for dense grid + real-time cursor |
| Tone.js + smplr for audio | Transport scheduling + SoundFont piano |
| `tonal` for music theory | TypeScript, active, Roman numerals, keys, modes |
| MIDI Type 1 for StudioOne export | No programmatic chord track API in S1; text events carry chord names |
| JWT auth (access + refresh) | Stateless, standard |
| PostgreSQL + JSONB for songs | Relational for users/auth; document storage for song data |
| Zustand + Immer for state | Undo/redo via patches or snapshots |

## Open Questions (unchanged from initial)

1. **StudioOne chord track auto-population** — needs runtime validation in Phase 6
2. **Piano sample quality** — may need to evaluate alternatives during Phase 4
3. **Drum track** — out of scope per requirements, data model supports it

## HITL Instructions

- **HITL approved the roadmap** with no notes.
- **HITL checkpoint is at end of Phase 2** (Grid Editor & Song State). Do not contact HITL before then unless absolutely critical.
- **PM model:** HITL changed PM from Sonnet to gpt-5.4. Enforce this on respawn.
- **Role boundary (2026-04-12):** Architect must **not** spawn Builders / QA / Reviewer / Integrator — **PM owns all spawns** per `ProjectManager.md`. See `HITL_NOTIFICATIONS.md` process correction.

## No Escalations Pending

No outstanding escalations at suspend.

## Build Progress Summary

- **Phase 0:** COMPLETE (7/7 merged)
- **Phase 1A:** COMPLETE (1A.1–1A.7 merged)
- **Phase 1B:** COMPLETE (1B.1–1B.6 merged)
- **Phase 2:** 14/15 merged (2.1–2.11, 2.13–2.15); **TASK-2.12 remains** (guide tone overlay)
- **`develop` tip:** `7b70fff` — TASK-2.13 PR #22 (latest merge)
- **Tests:** 29 files, **440 passed** on `develop` (verified)
- **PRs merged in this session:** #14 (2.7), #15 (2.10), #16 (2.8), #17 (2.8 hotfix), #18 (2.9), #19 (2.15), #20 (2.11), #21 (2.14), #22 (2.13)

## TASK-2.12 Resume Instructions

**This is the only thing blocking Phase 2 completion.**

- **Worktree:** `/home/thom/py/vYbpad-worktrees/task-2-12-guide-tones` — exists, branch `phase-2/guide-tones` checked out, at `7b70fff` (develop tip). **No commits yet, no remote branch pushed.**
- **Dependencies:** All met (TASK-1A.6 ✓, TASK-2.5 ✓, TASK-2.11 ✓).
- **Brief:** Already written in `PM_STATE.md` (search for "TASK-2.12"). PM needs to spawn Builder + QA on this worktree.
- **After 2.12 merges:** Phase 2 milestone complete → **HITL checkpoint** (standing instruction: Thom reviews at end of Phase 2) → Phase 3 (Persistence).

## Worktree Hygiene

6 active worktrees remain, 5 from merged tasks (can retire):
- `task-2-11-ui-store` — merged, retire
- `task-2-13-color-scheme` — merged, retire
- `task-2-14-canvas-tests` — merged, retire
- `task-2-15-song-store-tests` — merged, retire
- `task-2-9-entry-modes` — merged, retire
- `task-2-12-guide-tones` — **ACTIVE** (TASK-2.12 in progress)

## State Files to Read on Resume

1. `ARCHITECT_STATE.md` (this file)
2. `PM_STATE.md` (PM's cached state — PM owns updates)
3. `TASK_STATUS.md` (ground truth for task state — PM owns updates)
4. `ARCHITECTURE.md`, `INTERFACES.md`, `ROADMAP.md`, `PATTERNS.md` (canonical docs)

## Develop Branch HEAD at Suspend

**Tip on `develop`:** **`7b70fff`** (verify: `git fetch origin && git log -1 origin/develop`).
