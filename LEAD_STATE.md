# TECH LEAD STATE — vYbpad

> Tech Lead  continuity cache — **not** a substitute for `ARCHITECTURE.md`.

**Remote:** https://github.com/quickthom/vybpad — `origin`, default branch **`develop`**.

---
**CRITICAL NOTES — DO NOT REMOVE**

You are the Tech Lead. Per HITL direction, you shall not perform any task or portion of a task owned by another agent for any reason. If you are not able to follow subagent spawn protocols, escalate immediately. You should **never** write code or edit a PR body, as that responsibility belongs to the Builder. The checklist is not just paperwork. If the Builder cannot be trusted to properly fill out a PR with the self-review checklist, it cannot be trusted to write code. **The Tech Lead must never fabricate or complete the checklist on behalf of the Builder.**

**Failure to include the self-review checklist in the PR is not simply a blocker. It invalidates the PR and all of the Builder's commits. PERIOD.** Do not return the PR to the Builder if the checklist is missing or blank. Instead, revert the Builder's commits and start fresh with a new Builder. There are **no exceptions** to this policy.

**END CRITICAL NOTES**
---

## Open escalations

- *None.*

---

## Recent architectural decisions

**2026-04-13 — Local-only CI (GitHub Actions disabled)**

---

## Notes

- Canonical decisions live in `ARCHITECTURE.md`, `INTERFACES.md`, `PATTERNS.md`, `ROADMAP.md`, `UX_GUIDELINES.md`. Do not duplicate long-lived content here after a flush.

---

## Session continuity (2026-04-15) — Phase 7

**Authoritative task rows:** `TASK_STATUS.md` (this section is recovery/orchestration only).

### `develop` / remote

- **Sync:** `git pull origin develop` before spawning agents.

### Phase 7 — Wave 2 (merged on `develop`)

| Task | Status | PR | Notes |
|------|--------|-----|--------|
| 7.1–7.5 | merged | #64–#68 | Shortcut stack + clipboard + nav/transport (see `TASK_STATUS_ARCHIVE` / table) |

### Phase 7 — Wave 3 (merged 2026-04-15)

| Task | Status | PR | Notes |
|------|--------|-----|--------|
| 7.6 | merged | [#70](https://github.com/quickthom/vybpad/pull/70) | Reviewer block on `EditorCanvas`/`melodyRowHeight` remediated (`6eae0fb`); merged to `develop`. |
| 7.7 | merged | [#69](https://github.com/quickthom/vybpad/pull/69) | Integration merge `b884158` combined settings + piano in `EditorLayout`; then merged to `develop`. |

- **TASK-7.0** (phase-start cleanup): still **pending** — optional.

- **E2E / parallel agents:** PAT-030 — distinct Playwright port pair per worktree when multiple agents run full CI.

### Worktrees / branches

- Wave 3 feature branches merged; remove idle worktrees per PAT-017.

### Pipeline (plan)

- **Wave 4 (current):** TASK-7.10 — QA Playwright E2E for registered shortcuts (`TASK_STATUS.md`).
- **Wave 5–6:** 7.8 Designer + Builder polish → 7.9 min width (`useMinViewport1024` / UX §4).

### Local CI caveat (unchanged)

- Untracked nested `worktrees/` under the repo lint root can cause eslint “not found by the project service” noise. Prefer `ci-local` from a clean worktree or exclude stray paths.

---

## Last flush (archive)

**2026-04-15 (Phase 6 close)** — PRs **#55–#58** integrated on `develop` (MIDI export stack + TASK-6.7 tests). **TASK-6.6** StudioOne live check remains **HITL** (QA protocol only). `TASK_STATUS` archived Phase 6; README/CHANGELOG milestone docs pushed. PAT-017: Reviewers/QA briefed with explicit `<WORKTREE_ROOT>` paths for parallel work.

---
