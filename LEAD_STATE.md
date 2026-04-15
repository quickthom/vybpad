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

### Phase 7 — Wave 3 (2026-04-15 STATUS_UPDATE)

| Task | Status | PR | Notes |
|------|--------|-----|--------|
| 7.6 | **in-review** | [#70](https://github.com/quickthom/vybpad/pull/70) | Builder finished: `EditorSettingsPanel`, `settings` panel, localStorage `vybpad:editorUiSettings:v1`; head `d3f4746`; **self-review checklist present**; mergeable. **Next:** spawn Reviewer per gate (QA/Builder handshake + local CI on tip). |
| 7.7 | **in-review** | [#69](https://github.com/quickthom/vybpad/pull/69) | Piano panel + `piano` `activePanels`; checklist present; mergeable. **Next:** Reviewer when handshake complete. |

- **TASK-7.0** (phase-start cleanup): still **pending** — optional; does not block Wave 3 PRs.

- **E2E / parallel agents:** PAT-030 — distinct `PLAYWRIGHT_BASE_URL` / `PLAYWRIGHT_API_URL` (and matching `CORS_ORIGIN` / `VITE_API_URL`) per worktree when multiple agents run `./scripts/ci-local.sh`.

### Worktrees / branches

- Active feature branches: `phase-7/settings-panel`, `phase-7/piano-keyboard-panel` (see PRs above). Remove worktrees after merge per PAT-017.

### Pipeline (plan)

- **Wave 3:** Reviewer → merge **#69** / **#70** (order: assess `INTERFACES`-adjacent overlap; likely independent).
- **Wave 4:** 7.10 shortcut E2E after 7.1–7.5 stable (extend dependency to 7.6/7.7 when TL updates roadmap row if needed).
- **Wave 5–6:** 7.8 (Designer + Builder) → 7.9 min width.

### Local CI caveat (unchanged)

- Untracked nested `worktrees/` under the repo lint root can cause eslint “not found by the project service” noise. Prefer `ci-local` from a clean worktree or exclude stray paths.

---

## Last flush (archive)

**2026-04-15 (Phase 6 close)** — PRs **#55–#58** integrated on `develop` (MIDI export stack + TASK-6.7 tests). **TASK-6.6** StudioOne live check remains **HITL** (QA protocol only). `TASK_STATUS` archived Phase 6; README/CHANGELOG milestone docs pushed. PAT-017: Reviewers/QA briefed with explicit `<WORKTREE_ROOT>` paths for parallel work.

---
