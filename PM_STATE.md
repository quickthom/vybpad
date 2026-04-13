# PM STATE — vYbpad

> PM continuity handoff — **not** a duplicate of `TASK_STATUS.md`. Updated **2026-04-13** — **PAT-029 Step 2 complete**; PR #35/#36 CI polling (Helm PM).

---

## Designer continuity (persistent role)

- **F-06:** Periodic full UX review (Phase 3 close) **complete**; deliverables **on `develop`** (`b799146` with PAT-029): `UX_GUIDELINES.md` v1.2 deltas + `MILESTONE-F06-DESIGN-REVIEW.md`.
- **Session resume ID (Task tool):** `1ec3a385-fc7d-49ab-ae75-d63afeeb8b91` — use for the next Designer brief.
- **Prior shipped design work:** F-05 (#26) Phase 2 milestone review + UX v1.1; F-06 extends to Phase 3 persistence UI + Phase 4.1 playback shell on `develop`.
- **Non-blocking follow-up (Designer):** Optional product decision — explicit autosave success indicator vs silent success + error toasts; escalate to Architect only if PM wants a binding call.

---

## Remote & Tip

- **GitHub:** https://github.com/quickthom/vybpad — `origin`, default **`develop`**.
- **`develop` (local, main worktree):** Aligned with `origin/develop` at `9060701` (PAT-029 + F-06 + TASK-4.1 history). **2026-04-13 Helm PM:** `git fetch` — no drift vs `origin/develop`.
- **PAT-029:** On `develop` (`b799146` in history). PR #35 tip `d580624`, PR #36 tip `30de049` — rebased onto `9060701` and pushed (dual `webServer` harness inherited from `develop`).
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

**Context:** PAT-029 = Playwright waits for **both** `GET /api/health` (API) and Vite before E2E (`PATTERNS.md`). Step 1 landed on `develop`; Step 2 completed 2026-04-13 (rebase + `--force-with-lease` on both feature branches).

| Step | Owner | Action |
|------|--------|--------|
| **1** | **DevOps** | Commit listed PAT-029 files on **`develop`**, push to **`origin/develop`**. Main worktree only (PM/Integrator); do **not** use Builder worktrees for this. If push rejects (remote ahead), `git fetch` and coordinate with HITL before force-push. |
| **2** | **Builder** (×2, **PAT-017**) | After Step 1: in `task-4-2-piano-samples` → `git fetch && git rebase origin/develop` on `phase-4/piano-sample-loading`, push PR #35. In parallel, `task-4-3-harmony-voicing` → same for `phase-4/harmony-voicing-engine`, PR #36. Resolve conflicts; **preserve** `playwright.config.ts` harness from `develop`. |
| **3** | **PM + roles** | Monitor GitHub Actions on both PRs. **If failure is CI/workflow/Playwright harness/infra:** spawn **DevOps** to remediate. **If failure is app logic, tests, or feature code:** spawn **Builder + QA** (concurrent). When green, spawn **Reviewer** for final pass if needed. |

---


## PM tooling — Task spawn verification (2026-04-13)

- **Latest check (2026-04-13):** `Task` tool **available** — micro-test `generalPurpose` agent returned `SPAWN_CHECK_OK` (agent id `91c8f033-fb65-471b-a190-05d493647199`).
- **Prior Helm PM note:** Some Composer PM sessions lacked `Task`; if spawn fails again, use shell workarounds or human-started role sessions per PAT-029.

---

## Checkpoint — Handoff / Resume (2026-04-13)

- **PR #35** tip **`29eec40`** — remediation for failed run `24349784133` pushed (session bootstrap + transport E2E locator); **new CI runs** in progress on branch (e.g. `24351089304`).
- **PR #36** tip **`407a1cdd`** — CI run `24350860555` **FAILURE**: `client/tests/e2e/helpers/editor.ts` **regex literal** breaks Babel parse (`(?:/` closes `/.../` pattern) → **class: app test harness**; Builder+QA fix in flight.
- **Active gate:** #35 await fresh CI on `29eec40`; #36 await regex fix + rerun.
