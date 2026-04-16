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

## UI remediation (REF_AUDIT_1) — Waves 1–3 complete locally (2026-04-16)

- **Authoritative rows:** `TASK_STATUS.md` § UI Remediation.
- **Merged to `develop` (local):** **UI-W1** RA-1/RA-3 (`phase-8/ui-remediation-wave1`); **UI-W2** RA-2 + `ARCHITECTURE.md` canvas stack sync (`phase-8/ui-remediation-wave2`); **UI-W3** RA-5/RA-6 + `INTERFACES.md` `melodyChromaticEntryActive` (`phase-8/ui-remediation-wave3`, incl. chromatic-toggle remediation **5fdd283** after first Reviewer block).
- **Remote:** `git push` / `gh pr` were not available in the coordination environment — **HITL** should push `develop` and open or retro-file PRs if required by repo policy.
- **`./scripts/ci-local.sh`** was run green on `develop` after the Wave 3 merge + INTERFACES commit.

---

## TASK-8.0 — Phase-start tech debt (**merged** 2026-04-15)

Squash-merged to `develop` as **PR [#75](https://github.com/quickthom/vybpad/pull/75)** (MeasureBar `measuresPerLine` stride guard, TransportControls JSDoc, TASK-8.0 component tests, `editorUiSettingsLocalStorage` test spy fix for green `ci-local`). TASK-7.0 backlog and archive follow-ups addressed per plan; full brief text flushed — see merge commit and PR body.

---

## Test coverage pre-audit plan — **updated** 2026-04-15

**Artifact:** Cursor plan **`test_coverage_pre-audit_44b564bb.plan.md`** (stored in the operator’s Cursor plans directory — not vendored in this repo; search by filename if needed).

**Why:** Session work (TASK-8.0 merge, then archive follow-ups) affects **operational sequencing** for optional Vitest coverage (Phase E) and **narrative accuracy** for server/API and theory rows — not the core Phase 8.2–8.4 QA scope.

**Edits made:** Overview extended; §1.1 (theory barrel + API integration pointer); §1.2 (ESLint + generated `coverage/`); new **§6 Session delta** table (TASK-8.0, `archive-followups`, TASK-6.6 HITL); former §6 Summary renumbered to **§7**; summary row notes **8.0 ≠** workflow/a11y/visual E2E.

**Repo:** Plan narrative is satisfied on `develop` after **PR [#76](https://github.com/quickthom/vybpad/pull/76)** (theory barrel re-exports, deeper `api.integration` assertions, `eslint` ignores `**/coverage/**`, `LEAD_STATE` portability fix for plan pointer).

---

## Archive follow-ups — **merged** 2026-04-15

Squash-merged to `develop` as **PR [#76](https://github.com/quickthom/vybpad/pull/76)** (`06e9d3c`): `client/src/engine/theory` barrel for app imports, `server/tests/api.integration.test.ts` INTERFACES-shaped checks, `eslint.config.js` `**/coverage/**`, EditorCanvas grab JSDoc, `midiExporter` lint-directive cleanup, `LEAD_STATE` refresh. Remote branch `phase-8/archive-followups` deleted after merge.

---

## Session continuity — Phase 8 QA wave merged (2026-04-15)

**Authoritative task rows:** `TASK_STATUS.md`.

### `develop` / remote

- **`origin/develop`:** Phase 8 pre-audit QA deliverables merged: **#77** (TASK-8.1 coverage matrix), **#78** (TASK-8.2 full workflow E2E + `docs/CI_LOCAL.md` parity with `ci-local.sh` Prisma), **#79** (TASK-8.3 axe + TASK-8.4 visual baselines; orphan `task-8-3` snapshot dir removed), **#80** (optional Vitest `test:coverage`, report-only). Follow-on: **`TASK_STATUS.md`** commit marks **8.1–8.4** merged.
- **`ROADMAP.md`:** Task **8.3** + Phase 8 **milestone** require at least one automated check that **seeded song content is visibly rendered in the editor canvas** (not chrome-only baselines); complements renderer unit tests and workflow E2E.

### Next (per `ROADMAP.md`)

- **8.5–8.9** — production Docker, HTTPS/proxy, perf, deploy + smoke, HITL walkthrough.
- **TASK-6.6** StudioOne — still **HITL manual** (see matrix / `TASK_STATUS`).

### Local CI caveat (unchanged)

- Untracked nested `worktrees/` under the repo lint root can cause eslint “not found by the project service” noise. Prefer `ci-local` from a clean worktree or exclude stray paths.
- **`coverage/`:** `eslint.config.js` ignores `**/coverage/**` — local `vitest --coverage` + `npm run lint` should not fight generated HTML/JS under `coverage/`.

---

## Last flush (archive)

**2026-04-15 (Phase 6 close)** — PRs **#55–#58** integrated on `develop` (MIDI export stack + TASK-6.7 tests). **TASK-6.6** StudioOne live check remains **HITL** (QA protocol only). `TASK_STATUS` archived Phase 6; README/CHANGELOG milestone docs pushed. PAT-017: Reviewers/QA briefed with explicit `<WORKTREE_ROOT>` paths for parallel work.

---
