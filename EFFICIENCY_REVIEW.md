# EFFICIENCY STRATEGY — PM/Builder/QA/Reviewer Pipeline
## Objective
Reduce cycle time and token waste in the multi-agent delivery pipeline while preserving review quality and architectural compliance.
## ASSUMPTIONS
- This document proposes process changes only; no architectural/interface/UX contract changes are made here.
- The PM remains responsible for orchestration and sequencing decisions.
- Reviewer quality gates remain binding (no merge with open blockers).
- Integrator remains batched by milestone or wave boundary.
## Current Inefficiencies
### 1) Wave synchronization creates idle time
Observed pattern:
- PM spawns Builder/QA waves in parallel.
- PM waits for all PRs before spawning Reviewer waves.
- PM waits for all reviews before launching remediations.
Impact:
- Early-complete PRs sit idle.
- Blocked PRs wait unnecessarily for unrelated reviews.
- Median PR cycle time increases.
### 2) Remediation ownership is inconsistent
Observed risk:
- After review, remediation is sometimes delegated to newly spawned Builder/QA instances.
Impact:
- Re-onboarding cost each cycle.
- Higher odds of misinterpreting prior review context.
- Additional tokens spent reloading canonical context.
### 3) Re-review ownership is inconsistent
Observed risk:
- Re-review may be assigned to a new Reviewer each round.
Impact:
- Reviewer must reconstruct historical context.
- Feedback consistency can drift across passes.
- Expensive reviewer-token usage increases.

### 4) Builder/QA parallelism lacks a hard handshake gate
Current policy says QA writes failing tests first, but operationally the PM workflow does not always enforce a strict PR readiness gate tied to QA status.
Impact:
- Builder can finish feature code before QA baseline is stable.
- First review risks avoidable blockers (missing or mismatched tests).
### 5) Unlimited continuity risks context degradation
Continuity is useful, but repeatedly bouncing a PR between the same degrading instances can stall progress.
Impact:
- Repeated non-progress loops.
- Slower blocker resolution.
- Potential quality regression from local tunnel vision.
---
## Target Operating Model: Streaming With Guardrails
### Principle A — Stream PRs independently
Each PR moves through its own lifecycle as soon as it is ready:
`Builder/QA -> Reviewer -> Remediation -> Re-review -> Approved`
No artificial "wait for all PRs in wave" barrier before moving a single PR forward.
### Principle B — Keep integration batched
Only Integrator remains batch-oriented (milestone/wave boundaries), preserving controlled merges and conflict management.
### Principle C — Continuity by default, rotation by trigger
Default to same owners for speed and context continuity, but force rotation when objective degradation signals appear.
---
## Ownership Policy (Default)
### Remediation owner
- Primary: original Builder for the task branch.
- QA support: original QA for targeted regression updates when blocker scope impacts tests.
### Re-review owner
- Preferred: same Reviewer for first re-review pass.
- If same Reviewer unavailable, PM must include prior review summary and delta changes in the new Reviewer brief.
---
## Context-Degradation Circuit Breakers
Continuity is revoked for a PR when any trigger fires:
1. Same blocker (or equivalent defect) appears in two consecutive review rounds.
2. Blocker count does not decrease after one remediation cycle.
3. Reviewer feedback becomes contradictory across rounds.
4. Turnaround time worsens materially across two rounds (for example, remediation latency doubles without scope growth).
5. Two blocked re-review rounds on one PR (hard cap).
When triggered:
- Rotate Reviewer first if issue appears to be feedback consistency.
- Rotate Builder first if issue appears to be implementation quality.
- Optionally run one tie-breaker second review for contentious cases.
---
## QA/Builder Handshake Gates
A PR cannot be considered "review-ready" until all gates pass:
1. QA has sent `tests-written` status on the same branch.
2. Builder has run QA baseline (failing before implementation) and then rerun with implementation (passing).
3. Builder pre-flight checklist confirms:
   - QA tests pass.
   - Existing suite still passes.
   - Self-review checklist complete.
PM should enforce this explicitly before spawning Reviewer.
---
## Updated PM Orchestration Rules
1. Spawn Builder + QA concurrently per task (unchanged).
2. Process status events continuously (unchanged intent, stricter execution).
3. Spawn Reviewer per PR as soon as that PR is ready; do not wait for other PRs.
4. On blocked review, launch remediation immediately for that PR.
5. Re-review immediately after remediation for that PR.
6. Track per-PR round count and apply circuit breakers automatically.
7. Batch only integration.
---
## Briefing Standard for Re-Rounds (Delta Brief)
Every remediation or re-review handoff must include:
- Task ID and PR link.
- Prior blocker list (verbatim or concise normalized form).
- What changed since last round.
- What remains open.
- Explicit "do not re-litigate" list for resolved items.
This keeps continuity high even when rotation is necessary.
---
## Metrics (Minimal but Actionable)
Track these in PM state during a trial wave:
1. Time from PR ready -> first review verdict.
2. Time from blocked verdict -> remediation push.
3. Number of review rounds per PR.
4. Percent of PRs needing owner rotation.
5. First-pass approval rate.
Success criteria (initial):
- Lower median cycle time without increased post-merge defects.
- Reduced average review rounds per PR.
---
## Rollout Plan
### Phase 1 — Immediate process adoption (no role-file edits required)
- PM applies streaming progression and circuit-breaker decisions operationally.
- PM uses delta briefs for all re-rounds.
### Phase 2 — Codify in role docs
Update these files so behavior is enforced by instruction:
- `.cursor/agents/ProjectManager.md`
- `.cursor/agents/Builder.md`
- `.cursor/agents/QA.md`
- `.cursor/agents/Reviewer.md`
- `.cursor/skills/write-task-brief/SKILL.md`
Optional (Architect preference):
- Add a dedicated pre-authorized pattern in `PATTERNS.md` for "streaming review/remediation orchestration + context-degradation circuit breaker."
### Phase 3 — Evaluate and tune
- Run one full wave under the new model.
- Review metrics and adjust trigger thresholds.
---
## Recommended Policy Text (Architect-Ready)
Use this as the governing summary:
"The delivery pipeline operates per-PR as a streaming system. Continuity of Builder/QA/Reviewer ownership is preferred for speed and context retention, but ownership rotates when objective context-degradation triggers fire (repeat blockers, no blocker reduction, contradictory feedback, or max blocked rounds). Integration remains batched. Reviewer spawn is gated by QA/Builder handshake evidence."
