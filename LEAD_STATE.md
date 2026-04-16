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

## Operator backlog (OB-1 … OB-6) — **complete** (2026-04-16)

- **Merged to `develop` (squash PRs):** [#82](https://github.com/quickthom/vybpad/pull/82) OB-4 viewport/paintRef; [#83](https://github.com/quickthom/vybpad/pull/83) OB-3 note edge resize; [#84](https://github.com/quickthom/vybpad/pull/84) OB-5 magnetic snap; [#85](https://github.com/quickthom/vybpad/pull/85) OB-1+2 audition (PAT-026); [#86](https://github.com/quickthom/vybpad/pull/86) OB-6 UI density (rails aligned to **UX §3 288px** after first Reviewer block).
- **Authoritative rows:** `TASK_STATUS.md` § Operator backlog.
- **Worktrees** `…/ob-*` may still exist until HITL runs `git worktree remove` after verifying no uncommitted work.

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

## UI remediation (REF_AUDIT_1) — Waves 4–9 merged locally (2026-04-16)

- **Authoritative rows:** `TASK_STATUS.md` (UI-W4–UI-W9).
- **UI-W4** — branch `phase-8/ui-right-properties`: RA-4 right properties panel; INTERFACES melody visibility / inactive display / smart octave; artifact `docs/pull-requests/UI-W4.md`.
- **UI-W5** — branch `phase-8/ui-voices-discovery`: RA-7 + RA-8 chord library tabs; `ChordPaletteProps.libraryTab`; `buildScheduledPlayEvents` + `melodyVoiceVisible` (INTERFACES note under Audio scheduling); artifact `docs/pull-requests/UI-W5.md`. Remote merge initially lacked unpushed Builder tip — resolved by merging local `43721fe` into `develop`.
- **UI-W6** — branch `phase-8/ui-shell-consolidation`: RA-9/11/18 + RA-15 disabled stubs; `TransportControlsProps.loopContent`; artifact `docs/pull-requests/UI-W6.md`; TL INTERFACES commit `loopContent` before merge to clear Reviewer block.
- **UI-W7** — branch `phase-8/ui-palette-density`: RA-10/RA-12 dense chord rows + cycle/clear in `ChordProperties`; artifact `docs/pull-requests/UI-W7.md`.
- **UI-W8** — branch `phase-8/ui-transport-zoom`: INTERFACES `PlaybackStore` metronome/record + `TransportControls` zoom/tempo/key-meter; remediation `keyScaleTargetMeasureIndex` for TempoMeter dialog; artifact `docs/pull-requests/UI-W8.md`.
- **UI-W9** — branch `phase-8/ui-palette-cleanup`: RA-17/RA-19 heading + Reset + inspector cleanup; INTERFACES `onBrowseDefaultsReset`; TASK-8.4 visual PNGs updated; artifact `docs/pull-requests/UI-W9.md`.
- **`./scripts/ci-local.sh`** green on `develop` after Wave 9 (incl. snapshot commit).
- **Remote:** local `develop` is ahead of `origin/develop` — **HITL** should `git push` when credentials allow; `gh` was **401** for PR creation during coordination.

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
