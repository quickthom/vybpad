# PM STATE — vYbpad

> PM continuity handoff — **not** a duplicate of `TASK_STATUS.md`. Updated **2026-04-13** — **PAT-029 rollout orchestration** (PR #35/#36 unblock path).

---

## Designer continuity (persistent role)

- **F-06:** Periodic full UX review (Phase 3 close — overdue) **complete** (2026-04-13). Deliverable: `UX_GUIDELINES.md` v1.2 deltas + `MILESTONE-F06-DESIGN-REVIEW.md` (commit/integrate when convenient; not gated on open PRs).
- **Session resume ID (Task tool):** `1ec3a385-fc7d-49ab-ae75-d63afeeb8b91` — use for the next Designer brief.
- **Prior shipped design work:** F-05 (#26) Phase 2 milestone review + UX v1.1; F-06 extends to Phase 3 persistence UI + Phase 4.1 playback shell on `develop`.
- **Non-blocking follow-up (Designer):** Optional product decision — explicit autosave success indicator vs silent success + error toasts; escalate to Architect only if PM wants a binding call.

---

## Remote & Tip

- **GitHub:** https://github.com/quickthom/vybpad — `origin`, default **`develop`**.
- **`develop` (local, main worktree):** `b9c11ef` — includes TASK-4.1 stack in history (`ead7d21`) + HITL tip; **2026-04-13 verify:** `git ls-remote origin develop` returned `eab2ba3` — **local was 5 commits ahead of `origin/develop`** (reconcile push before using GitHub as sole SoT).
- **PAT-029:** Dual `webServer` + `GET /api/health` readiness exists in **uncommitted** `playwright.config.ts` (and related doc deltas) — **not** committed on `develop`; PR #35 (`fa1e791`) and #36 (`4ce103f`) **do not** include it (confirmed via `git show origin/phase-4/...:playwright.config.ts`).
- **Merged PRs:** #1–#23 Phase 0–2; Phase 3: #24–#32; Phase 4 launch: #34 (see `TASK_STATUS.md`).
- **Sync:** `git fetch origin && npm install` at repo root before any work.

---

## Standing Process Rules

- **PM owns the full pipeline:** brief → spawn Builder + QA → monitor → Reviewer → Integrator → update `TASK_STATUS.md` + `PM_STATE.md`.
- **QA concurrent** with every Builder — no exceptions.
- **PAT-017:** Isolated worktree per parallel Builder.
- **PAT-015:** Branch naming: `phase-N/<feature-slug>`, PR to `develop`.
- **PAT-019:** `yay` for system packages in agent shells when needed.
- **Spark flag:** Check per-task appropriateness before invoking Codex-Spark.
- **Escalations:** Route architectural ambiguity to Architect via `HITL.md` "Questions for Architect". Only hard product/external blockers go to HITL directly.
- **Escalation routing correction (HITL):** use a single Architect continuity path/session for architecture escalations; do **not** spawn fresh Architect instances per escalation.
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

## Phase 3 — Persistence Layer (closed)

**Status:** TASK-3.0–3.5 merged to `develop` (2026-04-13); PR #32 integrated at `eab2ba3`. Persistence milestone complete.

**Next:** Phase 4 sequencing active; launch next safe wave (`4.2`, `4.3`) with concurrent QA and explicit Playwright expansion gates.

**Worktrees:** `task-4-1-tone-init` retired after merge. Remaining legacy Phase 3 worktrees should be cleaned per PAT-017 when safe.

---

## Worktree Hygiene

Main worktree: `/home/thom/py/vYbpad` — stay on `develop`.
Stale: `task-2-8-keyboard` (harmless; `git worktree remove` when convenient).
All other Phase 2 worktrees retired 2026-04-13.

---

## Phase 4 launch notes

- Wave 1 executed as `TASK-4.1` only (safe dependency-first unlock), with concurrent Builder+QA and explicit Playwright criteria.
- Reviewer forced stronger E2E edge-case coverage (rapid repeated play during init); now covered in PR #34.
- Architect resolved contract drift for `PlaybackStore` and `TransportControlsProps`; PM must run interface pre-flight before each 4.x brief.
- Current coverage risk: local Playwright browser install fails in this environment (`write error -122`), so CI is the source of truth for E2E pass/fail until environment is repaired.
- Wave 2 launched in parallel: `TASK-4.2` (`phase-4/piano-sample-loading`, PR #35) and `TASK-4.3` (`phase-4/harmony-voicing-engine`, PR #36) with concurrent QA.
- Streaming results so far:
  - `TASK-4.2`: CI failed (`run 24330614635`) with strict Play locator ambiguity and persistence timeout; remediation commit `4f0b488` pushed.
  - `TASK-4.3`: CI failed (`run 24330973093`) after prior code fixes; targeted remediation round 2 launched but was interrupted before completion status.
- Operational risk: disk quota in this environment impacts local Playwright install and even some shell temp-file operations; CI check status currently pending for both PRs.
- CI gate tracking snapshot: both PR runs have now failed once; immediate remediation is in progress and next action is CI rerun + delta re-review.

---

## PAT-029 rollout — PM sequence (PR #35 / #36)

**Context:** PAT-029 = Playwright waits for **both** `GET /api/health` (API) and Vite before E2E (`PATTERNS.md`). Uncommitted files in main worktree `/home/thom/py/vYbpad` must land on `develop` first; feature PRs then rebase so CI runs with the harness.

| Step | Owner | Action |
|------|--------|--------|
| **1** | **DevOps** | Commit listed PAT-029 files on **`develop`**, push to **`origin/develop`**. Main worktree only (PM/Integrator); do **not** use Builder worktrees for this. If push rejects (remote ahead), `git fetch` and coordinate with HITL before force-push. |
| **2** | **Builder** (×2, **PAT-017**) | After Step 1: in `task-4-2-piano-samples` → `git fetch && git rebase origin/develop` on `phase-4/piano-sample-loading`, push PR #35. In parallel, `task-4-3-harmony-voicing` → same for `phase-4/harmony-voicing-engine`, PR #36. Resolve conflicts; **preserve** `playwright.config.ts` harness from `develop`. |
| **3** | **PM + roles** | Monitor GitHub Actions on both PRs. **If failure is CI/workflow/Playwright harness/infra:** spawn **DevOps** to remediate. **If failure is app logic, tests, or feature code:** spawn **Builder + QA** (concurrent). When green, spawn **Reviewer** for final pass if needed. |

---

## DevOps brief — Step 1 (PAT-029 commit + push) — **ISSUED**

**Assigned to:** DevOps (ephemeral task). **Working directory:** `/home/thom/py/vYbpad` (main worktree). **Branch:** `develop` (checkout before commit).

**Objective:** Land PAT-029 on remote `develop` so PR #35/#36 can rebase onto a harness-fixed base.

**Files to include in one commit** (verify `git status`; uncommitted PAT-029 bundle):

- `playwright.config.ts` — dual `webServer` entries (API health URL + Vite); matches PAT-029
- `PATTERNS.md` — PAT-029 section
- `ARCHITECTURE.md` — E2E harness note referencing PAT-029
- `ENVIRONMENTS.md` — Playwright / E2E env alignment if touched
- `README.md` — any PAT-029 / E2E doc delta
- `ARCHITECT_STATE.md` — Architect continuity note if present in bundle

**Do not** stage unrelated WIP (e.g. `TASK_STATUS.md`, `PM_STATE.md`, `UX_GUIDELINES.md`, `HITL_NOTIFICATIONS.md`, untracked `MILESTONE-F06-*`) unless HITL directs — keep this commit **harness + PAT-029 doc scope only**.

**Acceptance criteria:**

1. `develop` contains the dual–`webServer` `playwright.config.ts` at repo tip.
2. `git push origin develop` succeeds (or HITL-documented resolution if remote diverged).
3. Post-push: `git rev-parse origin/develop` matches local after fetch — PM updates `TASK_STATUS.md` event log on your STATUS_UPDATE.

**Patterns:** PAT-029 (read `PATTERNS.md`). Read `.cursor/agents/DevOps.md` and `ARCHITECTURE.md` before committing.

**Commit message (suggested):** `chore(ci): playwright dual webServer readiness (PAT-029)`

**PM spawn note:** This Cursor/Composer agent **cannot invoke the Task tool / subagent spawn API**. **Step 1 DevOps must be started manually:** open a DevOps agent (or new chat with DevOps role), paste this brief + path to `PM_STATE.md`, and run git only in the main worktree.

---

## Checkpoint — Handoff / Resume (2026-04-13)

- **PR #35** tip `fa1e791`; last CI `24334812645` **failure** — pending Step 1–2.
- **PR #36** tip `4ce103f`; last CI `24334450885` **failure** — same.
- **Active gate:** Step 1 (DevOps commit + push PAT-029 to `develop`); then Step 2 (parallel Builder rebases in isolated worktrees); then Step 3 (CI triage by failure class).
