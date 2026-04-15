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

## TASK-8.0 — Phase-start tech debt (**merged** 2026-04-15)

Squash-merged to `develop` as **PR [#75](https://github.com/quickthom/vybpad/pull/75)** (MeasureBar `measuresPerLine` stride guard, TransportControls JSDoc, TASK-8.0 component tests, `editorUiSettingsLocalStorage` test spy fix for green `ci-local`). TASK-7.0 backlog and archive follow-ups addressed per plan; full brief text flushed — see merge commit and PR body.

---

## Session continuity (2026-04-15) — Phase 7 closed

**Authoritative task rows:** `TASK_STATUS.md` (Phase 8 stub); Phase 7 detail in `TASK_STATUS_ARCHIVE.md`.

### `develop` / remote

- **Tip:** Phase 7 milestone integrated; `CHANGELOG.md` Phase 7 entry (2026-04-15); `UX_GUIDELINES` v1.4 on `develop`.

### Phase 7 — outcome summary

| Wave | Content | PRs |
|------|---------|-----|
| 7.1–7.5 | Shortcuts + clipboard + nav | #64–#68 |
| 7.6–7.7 | Settings + piano (EditorLayout integration) | #70, #69 |
| 7.10 | Shortcut E2E | #71 |
| 7.8 | UI polish + Designer `UX_GUIDELINES` §9 clarification | #72 + Designer commit `3c38bd9` |
| 7.9 | No separate PR — `EditorViewportGate` + F-07 E2E (pre-existing) | — |

- **TASK-7.0** cleanup: not run (optional debt).

### Next

- **Phase 8** — Final QA & Deployment (`ROADMAP.md`); populate `TASK_STATUS.md` Phase 8 table when first wave is briefed.

### Local CI caveat (unchanged)

- Untracked nested `worktrees/` under the repo lint root can cause eslint “not found by the project service” noise. Prefer `ci-local` from a clean worktree or exclude stray paths.

---

## Last flush (archive)

**2026-04-15 (Phase 6 close)** — PRs **#55–#58** integrated on `develop` (MIDI export stack + TASK-6.7 tests). **TASK-6.6** StudioOne live check remains **HITL** (QA protocol only). `TASK_STATUS` archived Phase 6; README/CHANGELOG milestone docs pushed. PAT-017: Reviewers/QA briefed with explicit `<WORKTREE_ROOT>` paths for parallel work.

---
