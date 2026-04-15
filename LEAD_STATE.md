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

## TASK-8.0 — Phase-start tech debt (2026-04-15)

**Policy:** TechLead.md § Tech Debt Cleanup (start-of-phase). **Branch:** `phase-8/tech-debt-cleanup` (PAT-015). **Parallelism:** Scoped to `client/src/**`, `server/src/**`, and targeted tests — **no** edits to `package.json`, `vitest.config.ts`, or `docs/TEST_COVERAGE_MATRIX.md` while TASK-8.1 / vitest-coverage branches may touch those paths.

### Inventory (ordered backlog)

| # | Source | Item | Triage |
|---|--------|------|--------|
| 1 | TASK_STATUS_ARCHIVE Phase 2 notes | `measuresPerLine=0` infinite-loop risk in measure strip layout | **In scope** — defensive clamp in `MeasureBar` `chunkMeasureIndices` (or equivalent). |
| 2 | TASK_STATUS_ARCHIVE Phase 2 | Hover `grab` / jsdom dead code | **Verify** — `EditorCanvas` still uses `cursor-grab` / `cursor-grabbing` (live). No removal unless confirmed dead. |
| 3 | TASK_STATUS_ARCHIVE | Stale `toggleEntryMode` in `uiStore.ts` | **Likely done** — verify; `toggleEntryMode` is documented in current `uiStore`. |
| 4 | TASK_STATUS_ARCHIVE | Theory import facade (1A.7); deeper API assertions (1B.6) | **Defer / narrow** — only if a small, behavior-neutral change; no large test expansion (8.1–8.4 own coverage waves). |
| 5 | Code grep | `TransportControls.tsx` JSDoc “Architect may merge into INTERFACES” | **In scope** — comment hygiene (contract is already in INTERFACES). |
| 6 | Code grep | `EditorCanvas.tsx` `TODO(Designer)` chord caption | **Out of scope** — Designer / UX spec; do not implement without Designer. |
| 7 | TASK-7.0 | Optional cleanup never executed | **Superseded** by this task (`TASK_STATUS.md` / `ROADMAP.md` updated). |

**Out of scope for Builder:** edits to `INTERFACES.md`, `UX_GUIDELINES.md`, new features, perf (ROADMAP 8.7), prod Docker/HTTPS (8.5–8.6).

---

### TASK BRIEF (issued)

```
TASK BRIEF
──────────────────────────────────────────────
Task ID:       8.0
Branch:        phase-8/tech-debt-cleanup
Assigned to:   Builder
Status:        in-progress

Objective:
  Address the Phase-start tech debt backlog (including rolled TASK-7.0 items) with comment hygiene and defensive fixes that do not change API or UX contracts.

Files expected to be created or modified:
  - client/src/components/controls/MeasureBar.tsx: clamp measures-per-line chunking so perLine ≤ 0 cannot infinite-loop (archive follow-up).
  - client/src/components/controls/TransportControls.tsx: replace obsolete JSDoc re: INTERFACES (contract already defined).
  - server/src/index.ts (optional): tighten JWT route comment to reference ARCHITECTURE only if still accurate.
  - Tests: add or extend unit/component coverage for MeasureBar edge case (perLine 0 or negative) — coordinate with QA if tests land first.

Acceptance criteria:
  1. `chunkMeasureIndices` (or call path) never loops infinitely when `measuresPerLine` is 0 or negative; layout remains sensible (e.g. treat as 1).
  2. Misleading or obsolete comments in touched files are fixed; no user-visible copy changes except where correcting wrong developer-facing text.
  3. `./scripts/ci-local.sh` passes on branch tip (docs/CI_LOCAL.md).
  4. No modifications to INTERFACES.md, UX_GUIDELINES.md, package.json, vitest.config.ts, or docs/TEST_COVERAGE_MATRIX.md on this branch.

Dependencies:
  None

Interfaces this task consumes (from INTERFACES.md):
  None — behavior-preserving cleanup; existing components remain contract-compliant.

UX guidelines this task must follow (from UX_GUIDELINES.md):
  N/A — no intentional UI changes; measure strip behavior unchanged for valid inputs.

Patterns to apply (from PATTERNS.md):
  PAT-002 (naming), PAT-006 (no stray console.log in production paths), PAT-015 branch naming.

──────────────────────────────────────────────
```

### QA BRIEF (issued)

```
QA BRIEF
──────────────────────────────────────────────
Task ID:       8.0
Branch:        phase-8/tech-debt-cleanup
Assigned to:   QA / Test Writer

This brief is concurrent with the Builder brief for 8.0.
Commit tests to the Builder's branch; confirm failing baseline for the new edge-case assertion(s), then green after Builder fix.

Acceptance criteria to test against:
  Same as TASK-8.0 Builder acceptance criteria (MeasureBar chunking safety; full ci-local green).

Interfaces to test against (from INTERFACES.md):
  MeasureBarProps — measuresPerLine is number; defensive behavior for non-positive values is implementation detail but must not hang or throw.

Your tests must be committed and failing before the Builder raises their PR.
When done, send a STATUS_UPDATE to the TL.
──────────────────────────────────────────────
```

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
