# PM STATE — vYbpad

> PM continuity handoff — **not** a duplicate of `TASK_STATUS.md`. Updated **2026-04-13** — **Priority:** **PR #35 merge is hard gate** before active work on **PR #36** (#36 parked). **Active lane:** #35 **CI remediation (Builder+QA spawned)** → green CI → PAT-027 handshake → Reviewer → Integrator → **then unpark #36** (same loop) → **TASK-4.4** next per dependency order after #36 merges.

---

## PR #35 — Active monitor (polling) — **ON**

- **Cadence (in effect):** **150s (~2.5 min)** between polls (within the **2–3 minute** band). Same command each time:
  `gh pr view 35 --repo quickthom/vybpad --json statusCheckRollup,headRefOid,mergeStateStatus,state`
- **Periodic mode (started 2026-04-13):** Background loop appends to **`/tmp/vybpad-pr35-polling.log`** (sleep **150** then poll; repeats). Stop with `pkill -f 'vybpad-pr35-polling'` or kill the job PID if HITL ends monitoring.
- **What changed vs stalled state:** Explicit **active monitor** flag here + fixed cadence + last-result line below so every PM/HITL touch includes a fresh poll or schedules the next one (no implicit “wait forever”).
- **Merge-order gate:** **#35 before #36** — unchanged; **#36 stays parked** until #35 lands on `develop`.
- **Latest CI (PR #35, 2026-04-13):** head **`3e73691`** — [run **`24360363016`](https://github.com/quickthom/vybpad/actions/runs/24360363016)** **`FAILURE`** — E2E **`persistence.happy`**: **`page.waitForResponse`** **90s timeout** (no response matched PUT + body predicate with both scale degrees). Prior **`49b5183`** fail: `putReq.response()` **null** ([`24360173331`](https://github.com/quickthom/vybpad/actions/runs/24360173331)). **Next push:** watch **new** `databaseId` on **`gh run list --branch phase-4/piano-sample-loading`** until **`test` SUCCESS** on current `headRefOid`.
- **Prior CI (PR #35):** [run **`24359238228`](https://github.com/quickthom/vybpad/actions/runs/24359238228)** on **`0e150d9`** — **`FAILURE`** (E2E `persistence.happy` — GET poll). User snapshot **`24356446158`** @ `3bdedd5` — **superseded**. **Truth:** never treat a superseded run as green.
- **Next poll:** after Builder+QA push → `gh pr view 35 --json statusCheckRollup` until **`test` conclusion SUCCESS** on **current** `headRefOid` (do not treat old run ids as green).
- **Last poll (immediate):** see **Checkpoint** (timestamp + JSON summary).

---

## Designer continuity (persistent role)

- **F-06:** Periodic full UX review (Phase 3 close) **complete**; deliverables **on `develop`** (`b799146` with PAT-029): `UX_GUIDELINES.md` v1.2 deltas + `MILESTONE-F06-DESIGN-REVIEW.md`.
- **Session resume ID (Task tool):** `1ec3a385-fc7d-49ab-ae75-d63afeeb8b91` — use for the next Designer brief.
- **Prior shipped design work:** F-05 (#26) Phase 2 milestone review + UX v1.1; F-06 extends to Phase 3 persistence UI + Phase 4.1 playback shell on `develop`.
- **Non-blocking follow-up (Designer):** Optional product decision — explicit autosave success indicator vs silent success + error toasts; escalate to Architect only if PM wants a binding call.

---

## Remote & Tip

- **GitHub:** https://github.com/quickthom/vybpad — `origin`, default **`develop`**.
- **`develop` / `origin/develop` tip (authoritative):** always `git fetch origin && git rev-parse origin/develop` — recent history includes **`ebc7fe5`** (process roles + PAT-025 `TASK_STATUS` migration, 2026-04-14).
- **PAT-029:** Dual `webServer` harness lives on `develop`; feature branches must inherit it via rebase onto current `develop`.
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
- **PAT-025 (2026-04-14):** `TASK_STATUS.md` has no live append-only event log; historical lines migrated to `TASK_STATUS_ARCHIVE.md`. Session detail stays in this file and batch-updates the status table.

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
- **Rebase gate:** **Complete.** Remote heads: **PR #35** `d7cbd0d600213cf20b7016ca32ebaff566e09b7c` (`phase-4/piano-sample-loading`); **PR #36** `2bc5be30a16901737104730ed9c71c0212997c04` (`phase-4/harmony-voicing-engine`). Both verified: `merge-base` includes `f9b8bd529fd24c8c83e104aa616f586c4ade44b8`.
- **Merge-order gate (user):** Do **not** spawn remediation/reviewer/integrator for **#36** while **#35** is open on `develop`. **#36:** optional passive `gh pr view` / Actions URL only; no Builder/QA pushes toward merge until #35 integrated.
- **CI — PR #35 (2026-04-13):** Remediation **`d8e6c84`** + **`3bdedd5`**; monitor [run **`24356446158`](https://github.com/quickthom/vybpad/actions/runs/24356446158)** on **`3bdedd5`**. Prior **failure** [`24355475894`](https://github.com/quickthom/vybpad/actions/runs/24355475894)/`9af5c18` (E2E persistence poll) **superseded**.

---

## PAT-029 rollout — PM sequence (PR #35 / #36)

**Context:** PAT-029 = Playwright waits for **both** `GET /api/health` (API) and Vite before E2E (`PATTERNS.md`). Step 1 landed on `develop`; Step 2 **complete** 2026-04-13 (rebase onto `f9b8bd5` + `--force-with-lease`; tips `d7cbd0d` / `2bc5be30`).

| Step | Owner | Action |
|------|--------|--------|
| **1** | **DevOps** | Commit listed PAT-029 files on **`develop`**, push to **`origin/develop`**. Main worktree only (PM/Integrator); do **not** use Builder worktrees for this. If push rejects (remote ahead), `git fetch` and coordinate with HITL before force-push. |
| **2** | **Builder** (×2, **PAT-017**) | **Current bar:** rebase target is **`origin/develop` @ `f9b8bd5`** (refresh with `git fetch`). In `task-4-2-piano-samples` → `git rebase origin/develop` on `phase-4/piano-sample-loading`, push PR #35 (`--force-with-lease`). In parallel, `task-4-3-harmony-voicing` → same for `phase-4/harmony-voicing-engine`, PR #36. Resolve conflicts; **preserve** `playwright.config.ts` / harness from `develop`. |
| **3** | **PM + roles** | **While #35 unmerged:** focus Actions + sequencing on **#35** only. **If failure:** infra → **DevOps**; app/tests → **Builder + QA**. **When #35 CI green + handshake:** spawn **Reviewer** (#35), then **Integrator** at approval. **#36:** defer active Step-3 execution until **#35 merged** (passive status OK). |

---


## PM tooling — Task spawn verification (2026-04-13)

- **Latest check (2026-04-13):** `Task` tool **available** — micro-test `generalPurpose` agent returned `SPAWN_CHECK_OK` (agent id `91c8f033-fb65-471b-a190-05d493647199`).
- **Prior Helm PM note:** Some Composer PM sessions lacked `Task`; if spawn fails again, use shell workarounds or human-started role sessions per PAT-029.

---

## Checkpoint — Handoff / Resume (2026-04-13)

- **Priority:** **#35 merge first** — **#36 parked** (no active remediation/review/integration on #36 until #35 on `develop`).
- **PR #35 — latest CI (2026-04-13):** head **`3e73691`** — [Actions **`24360363016`](https://github.com/quickthom/vybpad/actions/runs/24360363016)** **`FAILURE`** — E2E **`persistence.happy`**: **`waitForResponse` 90s timeout** (no PUT matched body predicate with both scale degrees; debounced saves may differ). Prior **`49b5183`**: `putReq.response()` **null** ([`24360173331`](https://github.com/quickthom/vybpad/actions/runs/24360173331)). **Next remediation:** Builder+QA — align waiter with final PUT or revert to stable **GET `expect.poll`** / explicit **Save** path. Worktree **`/home/thom/py/vYbpad-worktrees/task-4-2-piano-samples`**. **#36:** **parked**.
- **PR #35 — prior failure (run [`24359238228`](https://github.com/quickthom/vybpad/actions/runs/24359238228), head **`0e150d9`**):** E2E **`persistence.happy`** — GET poll **150s** timeout — **superseded** by later rounds. **Commits referenced:** QA `1565698`; Builder `57c4f23`; doc `0e150d9` (**`INTERFACES.md`** — **⛔ Architect review** if still on branch).
- **Queue after #35 green + merged:** **PR #36** active remediation/review/integrate same pattern; then **TASK-4.4** (`scheduler + Tone.Part`) when deps **4.1, 4.2, 4.3, 1A.2** satisfied — **no user prompt required** for PM advance.
- **2026-04-13 remediation spawn (PR #35) round 2:** Task **Builder** id `3ccdf5e9-61f0-4ef6-8856-79e2324f5f57` → pushed **`d8e6c84`** (EditorLayout: skip GET after POST bootstrap when Router drops `location.state`). Task **QA** id `535357e1-b963-4b8a-b1d8-6bfa93bbf249` → pushed **`3bdedd5`** (E2E: ensure Table entry mode before digit typing). **PR head:** `3bdedd5`.
- **Polling:** **`gh run list --repo quickthom/vybpad --branch phase-4/piano-sample-loading`** — watch **latest** run for **current** `headRefOid` until **`test` SUCCESS** (never treat superseded run ids as green) → PAT-027 → **Reviewer** (#35) → **Integrator**.
- **PR #36 (`2bc5be30`):** Passive only; **unpark** after #35 merge.
