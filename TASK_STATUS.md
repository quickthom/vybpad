# TASK STATUS — vYbpad

> Single source of truth for build state. Owned by the Project Manager. See PAT-025 for update protocol.

**`develop`:** Authoritative tip: `git fetch origin && git rev-parse origin/develop`. Recent commits include **`ebc7fe5`** (process roles + PAT-025 `TASK_STATUS` migration, 2026-04-14). **Rebase gate:** keep PR #35 / #36 rebased onto **`origin/develop`**. **Merge order (user priority):** **PR #35 must merge to `develop` before any active execution on PR #36** (review/remediation/integration on #36 parked until #35 lands). Sync: `git fetch origin && npm install` — https://github.com/quickthom/vybpad.
**Worktree hygiene:** Phase 3/4 worktrees under `/home/thom/py/vYbpad-worktrees/`. Retire after merge (PAT-017). If `gh pr merge` could not delete remote branches, remove worktree then `git push origin --delete <branch>`.

---

## Completed Phases

Phases 0 (7/7), 1A (7/7), 1B (6/6), Phase 2 (15/15) — see `TASK_STATUS_ARCHIVE.md`

---

## Phase 3 — Persistence Layer (Client)

**Goal:** User can save and load projects. **Status:** TASK-3.0–3.5 merged 2026-04-13; Phase 3 milestone complete.

| Task | Role | Branch | Status | PR | Depends | Notes |
|---|---|---|---|---|---|---|
| 3.0 | Builder | — | merged | #24 | None | Tech debt / comments |
| 3.1 | Builder | — | merged | #25 | 1B.5, 0.2 | Auth store + login/register |
| 3.2 | Builder | — | merged | #29 | 1B.5, 0.2 | Project list UI |
| 3.3 | Builder | — | merged | #30 | 2.1, 1B.3, 3.1 | Save/load editor ↔ API |
| 3.4 | Builder | — | merged | #31 | 3.3 | Squashed to develop 2026-04-13 |
| 3.5 | QA | — | merged | #32 | 3.1–3.4, 2.7–2.10 | Integrator merged to develop (`eab2ba3`) |
| F-02a | Documenter | — | merged | #28 | — | README + CHANGELOG + ENVIRONMENTS stub |
| F-02b | DevOps | — | merged | #27 | — | ENVIRONMENTS.md PAT-026 |
| F-05 | Designer | — | merged | #26 | — | Phase 2 design review + UX v1.1 |
| F-06 | Designer | — | merged | — | Phase 3 milestone | UX v1.2 + `MILESTONE-F06-DESIGN-REVIEW.md` on `develop` |

**Milestone:** User registers, logs in, creates a project, edits it, sees it auto-save, refreshes, logs in again, finds work intact.

---

## Phase 4 — Audio Playback

**Goal:** Press play, hear piano chords + melody, see cursor move. **Status:** Wave 2 — **#35-first:** PR #35 head **`3e73691`**; **CI** [run `24360363016`](https://github.com/quickthom/vybpad/actions/runs/24360363016) **FAIL** — E2E `persistence.happy`: **`waitForResponse` 90s timeout** (no PUT matching predicate with both chord degrees in body). Prior attempts superseded (`24356446158`…`24360173331`). **⛔** **`INTERFACES.md`** still touched on ancestor **`0e150d9`** — **Architect review**. **Next:** Builder+QA — relax waiter vs coalesced PUTs or ensure one PUT includes both chords. PR #36 **parked**.

| Task | Role | Branch | Status | PR | Depends | Notes |
|---|---|---|---|---|---|---|
| 4.1 | Builder + QA | — | merged | #34 | 0.2 | merged to develop (`ead7d21`) |
| 4.2 | Builder + QA | phase-4/piano-sample-loading | in-progress (CI remediation) | #35 | 4.1 | Head **`3e73691`**; **CI** [run `24360363016`](https://github.com/quickthom/vybpad/actions/runs/24360363016) **FAIL** E2E; **⛔ `INTERFACES.md`** (`0e150d9` ancestor); **#36 parked** |
| 4.3 | Builder + QA | phase-4/harmony-voicing-engine | parked (blocked on #35) | #36 | 1A.3 | **Gate:** no active remediation/review/integration until **PR #35 merged**. Tip `2bc5be30`; passive CI/branch status only — worktree `task-4-3-harmony-voicing` |
| 4.4 | Builder + QA | — | pending | — | 4.1,4.2,4.3,1A.2 | scheduler + Tone.Part |
| 4.5 | Builder + QA | — | pending | — | 0.2 | transport UI |
| 4.6 | Builder + QA | — | pending | — | 2.2,4.4 | playback cursor |
| 4.7 | Builder + QA | — | pending | — | 4.4,0.2 | mixer panel |
| 4.8 | Builder + QA | — | pending | — | 4.4,4.6 | loop bar |
| 4.9 | QA | — | pending | — | 4.3,4.4 | mocked Tone scheduling tests |
| 4.10 | QA | — | pending | — | 4.6 | Playwright playback E2E expansion |

---

## Phases 5–8

Per `ROADMAP.md`. Not yet decomposed into task briefs.

---

> **PAT-025:** Active-session narrative (CI run ids, remediation rounds) belongs in **`PM_STATE.md`**, not in an event log here. The Phase 4 lines that previously lived in an append-only log were migrated to **`TASK_STATUS_ARCHIVE.md`** (2026-04-14).
