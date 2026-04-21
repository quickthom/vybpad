# TECH LEAD STATE — vYbpad

> Continuity cache for the Tech Lead — **not** a substitute for `ARCHITECTURE.md`. **Authoritative task rows:** `TASK_STATUS.md`.

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

## Current state (2026-04-21)

**Focus:** **REF_AUDIT_2** UI remediation — **Wave 6 (OB-16 / OB-11 / OB-12) merged to `develop`** (#99, #100, #101). Execution plan: `~/.cursor/plans/ui_r2_waves_5-8_c9d08890.plan.md`.

**Wave 5 merges (merge order observed)**

- **UI-R2-W5.1** — [#94](https://github.com/quickthom/vybpad/pull/94), [#95](https://github.com/quickthom/vybpad/pull/95) (pitch-range pure helpers + lint hotfix).
- **UI-R2-W5.2** — [#96](https://github.com/quickthom/vybpad/pull/96) (render/hit-test alignment).
- **UI-R2-W5.3** — [#97](https://github.com/quickthom/vybpad/pull/97) (`measurePacking` + tests).
- **UI-R2-W5.4** — [#98](https://github.com/quickthom/vybpad/pull/98) (`EditorLayout` host-width → `MeasureBar` chunking; TC completed; TL squash-merged after PR review).

**Wave 6 merges (strict plan order)**

- **UI-R2-W6.1** — [#99](https://github.com/quickthom/vybpad/pull/99) (OB-16 viewport-bound shell + overflow tests).
- **UI-R2-W6.2** — [#100](https://github.com/quickthom/vybpad/pull/100) (OB-11 ChordPalette Search filtering).
- **UI-R2-W6.3** — [#101](https://github.com/quickthom/vybpad/pull/101) (OB-12 deterministic Popular shortlist via `getPopularChords`).

**Next (Wave 7 — plan order)**

- **UI-R2-W7.1** → **W7.5** per plan (shell density, dual zoom, overlays, toolbar). **No Wave 7 until Wave 6 integrated** — satisfied. Spawn **TaskCoordinator** per slice; watch `EditorLayout.tsx` / toolbar overlap per plan.

**`develop` health**

- Pre-merge gate remains **`./scripts/ci-local.sh`** on the PR branch tip (`docs/CI_LOCAL.md`); GitHub checks are not the authority.

**Subagent worktrees (mandatory)**

- **Builder and QA must not work in `/home/thom/py/vYbpad`.** TaskCoordinator provisions **dedicated git worktrees** (see `ENVIRONMENTS.md`, `PATTERNS.md` PAT-017 / PAT-030) and puts **`working_directory`** in every brief.

**Canonical merge gate**

- Green **`./scripts/ci-local.sh`** on the **PR branch tip**; Reviewer recommendation; Builder self-review checklist present. GitHub Actions are not the gate (`TechLead.md`).

---

## OB-12 (Popular chords) — brief for **UI-R2-W6.3**

Research conclusion (TL): prefer a **deterministic, context-aware diatonic shortlist** (fixed ordering / degrees from existing `theoryEngine` + scale data) — **not** live TheoryTab (out of scope per `ARCHITECTURE.md`). Pick cardinality **K** and test-id strategy in the task brief. Full audit context: `docs/audit/UI_REMEDIATION_OPERATOR_BACKLOG.md`, `docs/audit/REF_AUDIT_2.md`.

---

## CI / workspace hints

- Run **`ci-local`** from a clean tree; stray nested paths under the repo can confuse ESLint project resolution.
- **`coverage/`:** ignored by `eslint.config.js`; do not commit generated coverage HTML into the lint root.

---

## Archive

Older milestones (Phases 6–8, REF_AUDIT_1 waves, operator backlog OB-1–6): see **`TASK_STATUS.md`** and **`TASK_STATUS_ARCHIVE.md`** — not duplicated here.

**2026-04-13 —** Local-only CI: GitHub Actions automatic triggers disabled; **`./scripts/ci-local.sh`** is the pre-merge gate (`docs/CI_LOCAL.md`).
