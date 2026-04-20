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

## Current state (2026-04-20)

**Focus:** **REF_AUDIT_2** UI remediation **Waves 5–8** — execution plan: `~/.cursor/plans/ui_r2_waves_5-8_c9d08890.plan.md` (or latest name in Cursor plans dir).

**Gating — `develop` health**

- **`./scripts/ci-local.sh` must be green on `develop`** before restarting **UI-R2-W5.1**. Track as **`TECH-BASELINE-CI`** in `TASK_STATUS.md`: fix root causes (e.g. stray debug `fetch` ingest in `client/src/utils/apiClient.ts`, ESLint issues, failing unit/component/E2E). **Do not** “fix” CI by deleting tests or gutting assertions (HITL).
- After baseline merges, issue a **fresh** **UI-R2-W5.1** task brief and spawn **TaskCoordinator** (new branch; no reuse of abandoned PR).

**UI-R2-W5.1 reset**

- Prior **PR #92** was **closed**; remote branch **`phase-8/ui-r2-wave5-1-pitch-span`** was **deleted**. W5.1 is **pending** until baseline + new brief.

**Downstream**

- **UI-R2-W5.2–W5.4** and **W6.1–W6.3** are **blocked** on the merge-ordered chain (see `TASK_STATUS.md`). Wave 6 before Wave 7 per plan; no parallel `EditorLayout.tsx` churn across W6/W7 without merge plan proof.

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
