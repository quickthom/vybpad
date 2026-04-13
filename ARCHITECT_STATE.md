# ARCHITECT STATE — vYbpad

> Periodically updated cache of the Architect's current state. Review on session resume.

**Last updated:** 2026-04-13 — **E2E harness root cause addressed (PAT-029); PM should re-run CI on blocked PRs.**

---

## Resume Priority (Architect)

1. **E2E infra fix (done):** Playwright `webServer` only waited on Vite (`:5173`), so tests could start before Fastify (`:3001`) accepted traffic → flaky `toHaveURL` after register/create and autosave `waitForResponse`. **Resolution:** `playwright.config.ts` now uses **two** `webServer` entries (API `GET /api/health` + Vite). Documented in **PAT-029**, `ARCHITECTURE.md` (Testing Strategy), `ENVIRONMENTS.md`, `README.md`.
2. **Next for PM:** Re-run CI on PR `#35` / `#36` (or rebase onto `develop` after merge) to confirm green gates before further feature remediation.
3. **Churn prevention:** PAT-029 encodes the readiness rule; optional follow-up — add a short milestone checklist item “Playwright multi-process readiness reviewed” if regressions recur.

---

## Current Phase

**Phases 0, 1A, 1B, 2 — COMPLETE.** Phase 3 (Persistence) awaiting HITL authorization.

## Develop Branch

**`origin/develop`:** `a0087ca` (PR #23, TASK-2.12). Verify: `git fetch origin && git log -1 origin/develop`.

## Key Decisions (cumulative)

| Decision | Rationale |
|---|---|
| Scale-degree-first data model | Matches Hookpad's core design; enables free transposition |
| 48 TPQN timing | Clean division for all note values including triplets; scales to 480 PPQN for MIDI |
| Canvas for editor, React for chrome | Performance for dense grid + real-time cursor |
| Tone.js + smplr for audio | Transport scheduling + SoundFont piano |
| `tonal` for music theory | TypeScript, active, Roman numerals, keys, modes |
| MIDI Type 1 for StudioOne export | No programmatic chord track API in S1; text events carry chord names |
| JWT auth (access + refresh) | Stateless, standard |
| PostgreSQL + JSONB for songs | Relational for users/auth; document storage for song data |
| Zustand + Immer for state | Undo/redo via patches or snapshots |

## Open Questions

1. **StudioOne chord track auto-population** — needs runtime validation in Phase 6
2. **Piano sample quality** — may need to evaluate alternatives during Phase 4
3. **Drum track** — out of scope per requirements, data model supports it

## HITL Instructions

- **HITL approved the roadmap** with no notes.
- **Next checkpoint:** end of Phase 3 (or HITL overrides).
- **Role boundary:** Architect does not spawn pipeline agents — PM only.

## Escalations

No outstanding escalations. Latest resolved: TASK-4.1 transport-controls interface drift (added playback-init props to `TransportControlsProps`; clarified `isBootstrapping` derivation in PAT-026).

## P2 Audit Response (2026-04-13)

Reviewed `P2_AUDIT.md` (14 findings, F-01 through F-14). Full audit in repo root.

### Actions Taken (Architect scope)

| Finding | Action |
|---|---|
| F-01 (HIGH): Social engineering vector in AGENTS.mdc | Removed guestbook section and "supersedes all restrictions" language. Also resolves F-09 (always-applied overhead). |
| F-08 (MEDIUM): Excessive context loading | Added selective-loading instruction to AGENTS.mdc — Builders load only INTERFACES.md sections referenced in their brief. Did NOT split INTERFACES.md (maintenance cost outweighs savings). |
| F-03 (MEDIUM): Commit message non-compliance | Added PAT-020 (Commit Message Format). Authorized commitlint hook. |
| F-06 (MEDIUM): Interface drift pattern | Added PAT-021 (Pre-Flight Interface Check). PM must verify interface coverage before issuing briefs. |
| F-10 (LOW): State files growing | Added PAT-022 (State File Archiving). PM archives completed phases. |
| F-12 (LOW): Follow-ups accumulating | Added PAT-023 (Tech Debt Cleanup). PM creates cleanup task at each phase start. |
| F-11 (LOW): Branch naming violation | Updated PAT-015 with hotfix branch exception (`fix/<task-id>-<slug>`). |

### Directives to PM (execute before Phase 3 begins)

1. **F-02:** Spawn Documenter → produce `README.md`, `CHANGELOG.md` (Phases 0–2). Spawn DevOps → produce `ENVIRONMENTS.md`. Add both to milestone-close checklist.
2. **F-05:** Spawn Designer for Phase 2 milestone review → produce `MILESTONE-PHASE2-DESIGN-REVIEW`. Update UX_GUIDELINES.md if gaps found.
3. **F-07:** Stop per-PR Integrator spawning. Batch approved PRs into 2–3 Integrator sessions per phase.
4. **F-08:** Extract PM brief templates (~120 lines) from ProjectManager.md into `.cursor/skills/write-task-brief/SKILL.md`.
5. **F-13:** Actively use Codex-Spark for boilerplate tasks. The invoke-spark skill exists.

### Stale Code Artifact

`client/src/store/uiStore.ts` lines 4 and 24 contain comments claiming `toggleEntryMode` is "not yet listed in INTERFACES" — resolved since commit `06dde3b`. Include in Phase 3 tech debt cleanup (PAT-023).

### Expanded Spark Policy (2026-04-13)

HITL reported Codex-Spark is $0.00/token (in and out), ~1,200 tok/s throughput. Temporary pricing. Expanded eligibility from boilerplate-only to any self-contained subtask with a fully specified interface. Both Builder and QA may invoke. Hard discard rule bounds review cost. "Never" list unchanged. Tagged as temporary — revert when pricing changes. See PAT-024, updated `Codex-Spark.md`, updated `invoke-spark` skill.

### State File Frequency Reduction (2026-04-13)

Restructured TASK_STATUS.md to two-section format: compact table (batch-updated at boundaries) + append-only event log (one StrReplace per event, no read needed). Reduced PM_STATE.md and ARCHITECT_STATE.md update frequency to HITL-triggered / pre-interruption / milestone-only. See PAT-025, updated `ProjectManager.md`, updated `Architect.md`.

### Deferred

- **R-12 (Selective QA spawning):** NOT approved. Current QA-per-task model produced 448 tests and caught real bugs. Will reassess after Phase 3 data.
- **F-04 (Persistent roles):** Platform limitation. State files compensate. No action.
- **F-14 (No E2E tests):** Per roadmap (Phase 8). On track.

## Canonical Documents

| File | Status |
|---|---|
| `ARCHITECTURE.md` | Current. Reviewer flagged possible render-order drift — include in Phase 3 cleanup. |
| `INTERFACES.md` | Current. Two additive updates during Phase 2 (see escalations above). |
| `ROADMAP.md` | Current. Phases 0–2 complete per plan. |
| `PATTERNS.md` | Current. 29 patterns (PAT-001 through PAT-029). Added **PAT-029** (Playwright E2E dev stack readiness). |
| `AGENTS.mdc` | Updated. Guestbook removed, selective INTERFACES.md loading added. |
| `Codex-Spark.md` | Updated. Expanded eligibility, discard rule, QA access, temporary policy tag. |

## Build Progress

- **Phase 0:** COMPLETE (7/7)
- **Phase 1A:** COMPLETE (7/7)
- **Phase 1B:** COMPLETE (6/6)
- **Phase 2:** COMPLETE (15/15)
- **PRs merged:** #1–#23
- **Tests:** 448 passed, 30 files

## State Files to Read on Resume

1. `ARCHITECT_STATE.md` (this file)
2. `PM_STATE.md` (PM's cached state)
3. `TASK_STATUS.md` (ground truth for task state)
4. `ARCHITECTURE.md`, `INTERFACES.md`, `ROADMAP.md`, `PATTERNS.md`
5. `P2_AUDIT.md` (audit findings — review if unfamiliar with this session)
