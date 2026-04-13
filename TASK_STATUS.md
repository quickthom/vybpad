# TASK STATUS — vYbpad

> Single source of truth for build state. Owned by the Project Manager. See PAT-025 for update protocol.

**`develop` (verify with `git fetch origin`):** Tip `8b2a6bb` (PAT-030 + PAT-029 + F-06 + TASK-4.1 history). PR #35/#36 rebased onto `8b2a6bb` required before next remediation cycle. Sync: `git fetch origin && npm install` — https://github.com/quickthom/vybpad.
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

**Goal:** Press play, hear piano chords + melody, see cursor move. **Status:** Wave 2 active; TASK-4.2 / TASK-4.3 in CI gate — both PRs need rebase onto `8b2a6bb` (PAT-030 + PAT-029 harness) before next CI run.

| Task | Role | Branch | Status | PR | Depends | Notes |
|---|---|---|---|---|---|---|
| 4.1 | Builder + QA | — | merged | #34 | 0.2 | merged to develop (`ead7d21`) |
| 4.2 | Builder + QA | phase-4/piano-sample-loading | in-review (CI) | #35 | 4.1 | tip `29eec40`; worktree `task-4-2-piano-samples`; rebase onto develop required |
| 4.3 | Builder + QA | phase-4/harmony-voicing-engine | in-review (CI) | #36 | 1A.3 | tip `313206e`; worktree `task-4-3-harmony-voicing`; rebase onto develop required |
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
