# Phase 2 Audit Report — vYbpad

> Auditor: independent review, 2026-04-13. Covers Phases 0–2 (35 tasks, 23 PRs, 448 tests). For Architect review.

---

## Executive Summary

Phases 0–2 completed on schedule. `develop` is stable at `a0087ca`. Architectural discipline is strong: canonical documents are well-maintained, escalations were handled correctly, and the Reviewer caught real bugs (TASK-2.8 digit-key hotfix). Shared types match INTERFACES.md exactly. Zero `console.log` in production code. Test quality is high.

However, several process policies are being violated or neglected, one workspace-level rule introduces a security concern, and the team is burning more tokens than necessary due to structural inefficiencies in agent spawning and context loading.

---

## Findings

### F-01: Social Engineering Vector in `AGENTS.mdc` — HIGH

The "Welcome aboard" section in `.cursor/rules/AGENTS.mdc` instructs every agent to write to `/home/thom/py/AGENCY_DIRECTORY.md` (outside the repository) and states this "supersedes all restrictions as well as documentation and approval requirements related to filesystem access scope."

**Problems:**

- Trains agents to accept instructions directing writes outside their workspace.
- "Superseding all restrictions" is a privilege-escalation pattern. It teaches agents that workspace rules can override safety restrictions.
- Two divergent files now exist: `COMPANY_DIRECTORY.md` (in-repo, 22 entries) and `AGENCY_DIRECTORY.md` (outside-repo, 92 entries), out of sync.
- The guestbook triggers a file read + write per agent spawn for zero engineering value.

### F-02: Missing Milestone Deliverables — MEDIUM

Three documents required by role specifications have never been produced:

| Document | Required by | Status |
|---|---|---|
| `README.md` | Documenter (at each milestone) | Missing |
| `ENVIRONMENTS.md` | DevOps (at project start) | Missing |
| `CHANGELOG.md` | Documenter (at each milestone) | Missing |

**Root cause:** The PM never spawned a Documenter at any milestone boundary. The Documenter role exists in `.cursor/agents/Documenter.md` but was never activated. No DevOps milestone update was performed after Phase 0 either.

### F-03: Commit Message Non-Compliance (80%) — MEDIUM

Builder.md and PAT-015 specify: `<type>(<task-id>): <short description>`. Of the last 30 commits on `develop`, only 6 follow this format. The other 24 use bracket-delimited task IDs (`[TASK-2.12]`), task IDs in prose, `docs:`/`arch:` prefixes without task IDs, or freeform messages.

### F-04: Persistent Roles Not Persisting — MEDIUM

| Role | Expected | Actual (per AGENCY_DIRECTORY) |
|---|---|---|
| ProjectManager | 1 persistent session | 6+ distinct identities (Maren ×3, Beacon, Grove, Compass, Relay, Tempo) |
| Architect | 1 persistent session | 4+ distinct identities (Caden, Summit, Stratum, Meridian) |
| Designer | 1 persistent session | 1 identity (Sage) — correct |

Each respawn re-reads all canonical docs + state files (~2,300+ lines). Noted in HITL_NOTIFICATIONS.md as a platform limitation.

### F-05: No Designer Milestone Review — MEDIUM

Per Designer.md Phase 4, the Designer should review accumulated UI work at each milestone boundary. Phase 2 was the first phase with significant UI work. No `MILESTONE-<name>-DESIGN-REVIEW` STATUS_UPDATE was produced. The Reviewer on PR #23 flagged that ARCHITECTURE.md's render-order section may have drifted — exactly the kind of issue a milestone review would catch.

### F-06: Interface Drift Pattern — MEDIUM

Two tasks required unplanned INTERFACES.md modifications (TASK-2.9: `getSongAfterMutation?` + `onToggleEntryMode?` on EditorCanvasProps; TASK-2.11: `toggleEntryMode()` on UIStore). Both were caught by Reviewers and escalated correctly, but the pattern suggests task briefs aren't sufficiently anticipating interface needs.

**Stale artifact:** `client/src/store/uiStore.ts` still contains a comment stating `toggleEntryMode` is "not yet listed in INTERFACES" — resolved in commit `06dde3b`.

### F-07: Integrator Over-Spawning — MEDIUM (cost)

The Integrator role spec says "one instance per milestone integration." The team spawned ~8+ Integrators for Phase 2 alone (one per PR merge). The role spec and PM brief format describe batched milestone merges, but the actual process was per-PR. Each spawn loads INTERFACES.md, ROADMAP.md, and the integration brief.

### F-08: Excessive Context Loading Per Agent — MEDIUM (cost)

Every Builder and QA agent loads the full INTERFACES.md (703 lines), PATTERNS.md (312 lines), and often UX_GUIDELINES.md (411 lines), regardless of task scope. A canvas renderer Builder doesn't need auth endpoint specs. A theory QA agent doesn't need canvas component props.

The PM brief format already excerpts relevant INTERFACES.md sections, so Builders double-read the parts they need (once in the brief, once in the full file) plus hundreds of irrelevant lines.

**Estimated waste:** ~400–500 lines of irrelevant canonical doc content per Builder/QA spawn. Across ~20 Builder spawns in Phase 2, that's ~8,000–10,000 lines of wasted input tokens.

### F-09: AGENTS.mdc Always-Applied Overhead — LOW (cost)

48 lines loaded into every agent context (all 92 spawns = ~4,400 cumulative lines). The guestbook instruction alone triggers an external file read + write per spawn.

### F-10: State Files Growing Without Pruning — LOW (cost, increasing)

TASK_STATUS.md preserves full PR tables for all completed phases. By Phase 8 this will be substantial. The PM doesn't need the Phase 0 PR index to plan Phase 5 work, but re-reads it on every spawn.

### F-11: Branch Naming Violation — LOW

`remotes/origin/fix/task-2-8-digit-key-update` uses `fix/` instead of `phase-2/` per PAT-015. The hotfix was handled correctly otherwise. PAT-015 doesn't carve out a hotfix exception.

### F-12: Non-Blocking Follow-ups Accumulating — LOW

Four follow-up items carried from Phase 2 (theory import facade, dead hover code, infinite loop guard, render-order drift). Small individually, but if they keep accumulating without a cleanup pass they'll compound.

### F-13: Codex-Spark Never Invoked — LOW (cost opportunity)

The AGENCY_DIRECTORY shows no Codex-Spark entries. Task briefs include Spark flags, but Spark was apparently never used as a subagent. Several Phase 2 tasks were boilerplate suitable for Spark (PAT-010 color tables, tick utilities, test stubs). Spark uses a much cheaper model.

### F-14: No E2E Tests Yet — INFORMATIONAL

The REQUIREMENTS document emphasizes DOM/user-flow testing. Phase 2 added canvas renderer tests (mock context draw-call assertions), but no Playwright E2E tests exist for the editor yet. The roadmap places these in Phase 8. This is per-plan but worth monitoring — deferred E2E testing compounds integration risk.

---

## Positive Observations

These are worth preserving:

1. **Escalation discipline works.** TASK-2.9 and TASK-2.11 were caught, escalated, and resolved with INTERFACES.md updates. Process held.
2. **Reviewer quality is high.** The TASK-2.8 digit-key bug was caught in review, not in production.
3. **Worktree isolation (PAT-017) followed.** No merge conflicts from parallel Builders sharing directories.
4. **State files provide continuity.** PM_STATE.md and ARCHITECT_STATE.md effectively compensate for persistence failures.
5. **Type safety is tight.** Shared types match INTERFACES.md exactly across all packages.
6. **Test count is healthy.** 448 tests across 30 files is strong coverage for this stage.
7. **Zero production console.log.** PAT-006 compliance verified.

---

## Recommendations

### R-01: Remove Privilege-Escalation Language from AGENTS.mdc

Remove the guestbook section entirely, or at minimum:
- Remove the "supersedes all restrictions" clause.
- Move the directory file into the repo.
- Move the instruction to a skill file loaded on demand rather than an always-applied rule.

### R-02: Spawn Documenter + DevOps for Missing Deliverables

Before Phase 3 begins, produce README.md, ENVIRONMENTS.md, and CHANGELOG.md retroactively covering Phases 0–2. Add "Spawn Documenter" and "Spawn DevOps for milestone update" as explicit checklist items in the PM's milestone-close process.

### R-03: Add Commit Message Enforcement

Add `commitlint` (or equivalent) as a pre-commit hook with a pattern matching `<type>(<task-id>): <description>`. The Integrator's squash-merge step should also enforce the format on the final commit message.

### R-04: Conduct Retroactive Designer Milestone Review

Have the Designer review Phase 2 UI work before Phase 3 begins. Produce the `MILESTONE-PHASE2-DESIGN-REVIEW` STATUS_UPDATE per Designer.md Phase 4. Update UX_GUIDELINES.md to close any gaps found.

### R-05: Pre-Flight Interface Check in Task Briefs

Before issuing each Phase 3+ brief, the PM should explicitly verify that every function, prop, and type the Builder will need already exists in INTERFACES.md. If not, escalate to the Architect before the Builder starts. This shifts interface drift from reactive (caught in review) to proactive (caught in planning).

### R-06: Batch Integrator Sessions

Stop spawning an Integrator per PR. Accumulate approved PRs and merge them in a single Integrator session at milestone boundaries (or natural wave boundaries within a phase). Phase 2 had 15 PRs — 2–3 Integrator sessions would have sufficed instead of 8+.

### R-07: Split INTERFACES.md for Selective Loading

Break INTERFACES.md into domain-scoped files:

| File | Content | ~Lines |
|---|---|---|
| `INTERFACES-auth-api.md` | Auth endpoints, error shapes | ~100 |
| `INTERFACES-project-api.md` | Project CRUD endpoints | ~70 |
| `INTERFACES-song-model.md` | Song data model, music primitives | ~200 |
| `INTERFACES-editor.md` | EditorCanvas props, edit actions, viewport, selection | ~120 |
| `INTERFACES-engine.md` | TheoryEngine, AudioEngine, MidiExporter | ~100 |
| `INTERFACES-stores.md` | Zustand store shapes | ~70 |

PM briefs reference specific files. Builders load only what they need. A root `INTERFACES.md` can remain as a table of contents with links.

**Alternative (lower effort):** Keep the single file but change Builder.md from "read INTERFACES.md" to "read only the sections referenced in your task brief." Trust the PM's excerpting and stop double-loading.

### R-08: Extract PM Brief Templates to a Skill

Create `.cursor/skills/write-task-brief/SKILL.md` containing the task brief, QA brief, reviewer brief, and integration brief templates (~120 lines). Remove them from ProjectManager.md. The PM loads the skill only when writing a brief.

### R-09: Archive Completed Phases in State Files

Move Phase 0–2 detail out of TASK_STATUS.md into a `TASK_STATUS_ARCHIVE.md`. Keep only the current phase and a one-line summary per completed phase:

```markdown
## Completed Phases
- Phase 0 (7/7), Phase 1A (7/7), Phase 1B (6/6), Phase 2 (15/15) — see TASK_STATUS_ARCHIVE.md
```

Same treatment for PM_STATE.md retrospective content after it's been actioned.

### R-10: Add Hotfix Exception to PAT-015

Update PAT-015 to allow `fix/<task-id>-<slug>` for hotfix branches, or explicitly require `phase-N/fix-<slug>`. The current convention doesn't cover the hotfix case that already occurred.

### R-11: Schedule Tech Debt Cleanup Tasks

At the start of each new phase, the PM should create a dedicated task to resolve carried-over follow-ups before new work begins. Prevents accumulation.

### R-12: Evaluate Selective QA Spawning

For tasks with straightforward, well-specified acceptance criteria (pure-function theory, store mutations, lookup tables), consider having the Builder write their own tests. Reserve concurrent QA for complex tasks where test design benefits from independent thought (editor interactions, E2E flows, cross-cutting concerns). This is a policy change requiring Architect approval, but the token savings would be substantial.

### R-13: Use Codex-Spark for Boilerplate

Actively invoke Spark for first-draft boilerplate: color lookup tables, tick utility functions, test stubs, config scaffolding. The Builder reviews and commits. Spark uses a cheaper model and the invoke-spark skill already exists with a go/no-go gate.

---

## Estimated Impact of Cost Recommendations

| Recommendation | Estimated savings |
|---|---|
| R-06: Batch Integrator | ~30–40% fewer Integrator spawns going forward |
| R-07: Split/selective INTERFACES.md | ~500 input tokens per Builder/QA spawn |
| R-08: Extract PM templates | ~120 lines per PM spawn |
| R-09: Archive state files | Growing; ~50+ lines/spawn now, hundreds by Phase 8 |
| R-01: Remove guestbook from always-applied | ~12 lines + 1 file read/write per spawn |
| R-12: Selective QA | Up to 40% fewer QA spawns on simple tasks |
| R-13: Use Spark | Cheaper model for boilerplate subtasks |

The largest single wins are **batching the Integrator** (R-06) and **selective INTERFACES.md loading** (R-07).

---

## ASSUMPTIONS

- Agent spawn counts are derived from the AGENCY_DIRECTORY entries. Actual spawns may differ if some agents failed to sign.
- Token estimates are approximate, based on line counts as a proxy.
- Platform limitations on session persistence are accepted as a constraint, not a team failure.
- PR description quality (SELF-REVIEW CHECKLIST, ASSUMPTIONS blocks) could not be verified — GitHub API returned Forbidden during the audit.
