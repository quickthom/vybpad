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

- **Sync:** `git pull origin develop` before spawning agents. `INTERFACES.md` on `develop` includes `SongStore.editNoteBatch` and `EditorCanvasProps.onNoteEditBatch`; `TASK_STATUS.md` marks **7.3 merged** (see table there for current rows).

### Phase 7 — Wave 2 progress

| Task | Status | PR | Notes |
|------|--------|-----|--------|
| 7.1 | merged | #64 | PAT-027 shortcut manager + shell wiring |
| 7.2 | merged | #65 | Granular duration `ShortcutCommandId`s; duration keys via registry |
| 7.3 | merged | #66 | Split/tie/triplet; `editNoteBatch`; `Slash` vs `/` registration fix (`task73ShortcutChords.ts`); Reviewer round 2 approve |
| 7.4 | **next** | — | Clipboard JSON (`copySelection` / `pasteSelection`, PAT-028); brief branch e.g. `phase-7/clipboard-json` + PAT-017 worktree |
| 7.5 | pending | — | Navigation / playback shortcuts (after 7.4 per plan) |

- **TASK-7.0** (phase-start cleanup): still **pending** in `TASK_STATUS.md` — optional early merge; does not block 7.4+.

- **Wave 0 contracts:** Shortcut + clipboard shapes largely in `INTERFACES.md` / `PATTERNS.md` (PAT-027, PAT-028); TL extends `INTERFACES` when implementation discovers gaps (e.g. 7.2 duration command ids, 7.3 batch API on `SongStore` / `EditorCanvas`).

### Worktrees / branches

- **Removed after merge:** `…/phase-7-split-tie-triplet` (TASK-7.3).
- **Operator:** create a fresh worktree per concurrent Builder/QA pair under `<WORKTREE_ROOT>` (see `ENVIRONMENTS.md`); remove after merge.

### Pipeline (plan)

- **Wave 2:** sequential **7.4 → 7.5** (shortcut behaviors; avoid parallel file collisions on editor shell).
- **Wave 3:** 7.6 / 7.7 parallel candidates after 7.5 boundary clear.
- **Wave 4:** 7.10 E2E after 7.1–7.5 stable.
- **Wave 5–6:** 7.8 (Designer + Builder) → 7.9 min width.

### Local CI caveat (unchanged)

- Untracked nested `worktrees/` under the repo lint root can cause eslint “not found by the project service” noise. Prefer `ci-local` from a clean worktree or exclude stray paths.

---

## Last flush (archive)

**2026-04-15 (Phase 6 close)** — PRs **#55–#58** integrated on `develop` (MIDI export stack + TASK-6.7 tests). **TASK-6.6** StudioOne live check remains **HITL** (QA protocol only). `TASK_STATUS` archived Phase 6; README/CHANGELOG milestone docs pushed. PAT-017: Reviewers/QA briefed with explicit `<WORKTREE_ROOT>` paths for parallel work.

---
