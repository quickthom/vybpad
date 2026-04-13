# PM STATE — vYbpad

> PM continuity handoff — **not** a duplicate of `TASK_STATUS.md`. Updated **2026-04-13** — **Phase 2 COMPLETE.** HITL checkpoint active. Phase 3 awaiting authorization.

---

## Remote & Tip

- **GitHub:** https://github.com/quickthom/vybpad — `origin`, default **`develop`**.
- **`develop` HEAD:** `a0087ca` — Phase 2 complete (PR #23 = TASK-2.12, last merge). **448 tests, 30 files.**
- **Merged PRs:** #1–#23 (full index in `TASK_STATUS.md`).
- **Sync:** `git fetch origin && npm install` at repo root before any work.

---

## Standing Process Rules

- **PM owns the full pipeline:** brief → spawn Builder + QA → monitor → Reviewer → Integrator → update `TASK_STATUS.md` + `PM_STATE.md`.
- **QA concurrent** with every Builder — no exceptions.
- **PAT-017:** Isolated worktree per parallel Builder.
- **PAT-015:** Branch naming: `phase-N/<feature-slug>`, PR to `develop`.
- **PAT-019:** `yay` for system packages in agent shells when needed.
- **Spark flag:** Check per-task appropriateness before invoking Codex-Spark.
- **Escalations:** Route architectural ambiguity to Architect (not HITL) via `HITL_NOTIFICATIONS.md` "Questions for Architect" section. Only hard product/external blockers go to HITL directly.
- **PM model:** gpt-5.4 (HITL directive).

---

## Phase 2 Retrospective (lessons for Phase 3+)

1. **Barrel export conflicts** on `index.ts` are the main merge friction when parallel Builders touch the same package. Resolve by keeping all exports; consider pre-creating the barrel line in a prep commit if 3+ Builders will add to the same file.
2. **Interface drift is real.** Builders added props not in `INTERFACES.md` twice (TASK-2.9, TASK-2.11). Reviewers correctly caught both. Enforce: any new prop/method not in `INTERFACES.md` → immediate escalation before merge.
3. **Hotfix pattern works.** TASK-2.8 digit-key bug caught by Reviewer, fixed in a separate hotfix PR (#17) on a dedicated branch. Clean and traceable.
4. **Worktree hygiene requires active retirement.** Phase 2 accumulated 14+ worktrees before cleanup. Retire immediately after PR merge, not in batches.
5. **`develop` should stay fast-forward-only on the main worktree.** Local HITL commits on develop can diverge from squash-merged PRs — rebase onto `origin/develop` after PR merges to keep history linear.

---

## Non-blocking Follow-ups (carried from Phase 2)

- **PR #5 / #7 Reviewer notes:** theory import facade suggestion; deeper `bandConfig` + cross-user 404 API test assertions.
- **TASK-2.7:** hover cursor `grab` is dead code in jsdom — fix in a polish pass.
- **TASK-2.10:** `measuresPerLine=0` infinite loop guard; `pointerup` listener cleanup on unmount.
- **TASK-2.12 Reviewer warning:** `ARCHITECTURE.md` render-order section may have drifted from actual canvas pass order — Architect should audit.

---

## Phase 3 — Persistence Layer (next)

**Status:** Awaiting HITL checkpoint authorization.

**ROADMAP tasks:**

| Task | Depends on | Parallel | Summary |
|---|---|---|---|
| 3.1 Auth store + login/register UI | 1B.5 ✓, 0.2 ✓ | 3.2 | Zustand auth store, minimal login/register forms |
| 3.2 Project list UI | 1B.5 ✓, 0.2 ✓ | 3.1 | Create/open/delete projects |
| 3.3 Save/load integration | 2.1 ✓, 1B.3 ✓, 3.1 | — | Wire song store ↔ API client |
| 3.4 Auto-save | 3.3 | — | Debounced PUT on `isDirty` |
| 3.5 Auth + persistence E2E | 3.1–3.4 | — | Full round-trip test |

**Parallelism:** 3.1 ∥ 3.2 (no shared files). 3.3 sequential after 3.1. 3.4 after 3.3. 3.5 after all.

**Milestone:** User registers, logs in, creates a project, edits, auto-saves, refreshes, logs back in, finds work intact.

**When authorized:** PM decomposes into full Builder + QA briefs, creates worktrees, spawns agents.

---

## Worktree Hygiene

Main worktree: `/home/thom/py/vYbpad` — stay on `develop`.
Stale: `task-2-8-keyboard` (harmless; `git worktree remove` when convenient).
All other Phase 2 worktrees retired 2026-04-13.
