# HITL Notifications — vYbpad

> **Purpose:** Human-in-the-loop log. When the Architect or PM would otherwise interrupt Thom for coordination, status, or questions, **write it here** instead. Thom reads this on return.

**Standing instruction:** Next HITL checkpoint is **end of Phase 3** (Persistence). Use this file for async handoff, not routine chat.

---

## Log (newest first)

### 2026-04-13 — Architect (Caden): Phase 2 COMPLETE — HITL checkpoint

- **Phase 2 milestone reached.** All 15/15 tasks merged. `develop` = `a0087ca` (PR #23). **448 tests, 30 files.**
- **State documents cleaned** for Phase 3 entry: `TASK_STATUS.md`, `PM_STATE.md`, `HITL_NOTIFICATIONS.md`, `ARCHITECT_STATE.md` — stale Phase 2 operational detail removed, PR index and process learnings preserved.
- **Awaiting HITL:** Phase 3 authorization. Roadmap: auth store + login UI, project list UI, save/load integration, auto-save, E2E tests.
- **Reviewer warning (non-blocking):** `ARCHITECTURE.md` render-order section may have drifted from actual canvas pass order. Will audit on request.

---

## Open Questions for Thom

- **Tooling (carried from Phase 2, non-blocking):** Task/subagent spawn is available in Cursor primary UI but was not reliably available in Composer-routed PM sessions. PM used `gh` + local git for Integrator steps when subagents were unavailable. Confirm preferred approach, or accept current hybrid.

_(Empty = no product/code blockers.)_

---

## Questions for Architect (PM / agents — Thom offline)

_Use this for architectural ambiguity that cannot be resolved from `ARCHITECTURE.md` / `PATTERNS.md`. Architect resolves here; Thom reads on return._

_(No open questions.)_

---

## Phase 2 Log (archived)

<details>
<summary>Phase 2 notification history (2026-04-12)</summary>

### Escalation: TASK-2.9 EditorCanvasProps — RESOLVED

PM (Tempo) escalated: Builder added `getSongAfterMutation?` and `onToggleEntryMode?` to `EditorCanvasProps` without INTERFACES.md coverage. Architect (Meridian) resolved: Option A — add both optional props. Rationale: callback symmetry with existing controlled props; `getSongAfterMutation` solves React/Zustand render-cycle timing; both optional (no breaking change). INTERFACES.md updated (`d3bd016`). PR #18 unblocked and merged.

### Escalation: TASK-2.11 UIStore.toggleEntryMode — RESOLVED

Reviewer (Refrain) disclosed: Builder (Coda) added `toggleEntryMode()` to UIStore implementation but method was absent from INTERFACES.md. Architect added it (`06dde3b`). Non-breaking, additive.

### Process correction: PM owns spawns

Architect session violated role boundaries by spawning Builder/Reviewer/Integrator agents. Corrected: `Architect.md` updated with explicit "never" rule. PM is the sole owner of pipeline agent spawns.

### Key operational events

- Wave 1 (TASK-2.1, 2.2): Builder + QA on PAT-017 worktrees → PRs #8, #9 → squash-merged.
- Wave 2a (TASK-2.3, 2.4, 2.5): Three parallel Builders → PRs #10, #11, #12 → merged in order #10→#12→#11 (barrel conflict resolved).
- TASK-2.6 (hit testing): PR #13 → merged.
- TASK-2.7 (mouse): PR #14 → merged.
- TASK-2.8 (keyboard): PR #16 + hotfix PR #17 → merged.
- TASK-2.9 (entry modes): PR #18 → escalation → resolved → merged.
- TASK-2.10 (measure bar): PR #15 → merged.
- TASK-2.11 (UI store): PR #20 → merged.
- TASK-2.12 (guide tones): PR #23 → merged (final Phase 2 task).
- TASK-2.13 (color scheme): PR #22 → merged.
- TASK-2.14 (canvas tests): PR #21 → merged.
- TASK-2.15 (song store tests): PR #19 → merged.
- Test count progression: 236 → 289 → 314 → 325 → 335 → 368 → 378 → 392 → 440 → 448.

</details>
