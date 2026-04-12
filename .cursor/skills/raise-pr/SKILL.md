---
name: raise-pr
description: Use this skill when a Builder agent is ready to raise a pull request. Guides the agent through composing a complete, correctly structured PR description including the self-review checklist, ASSUMPTIONS block, blocking flags, and Spark disclosure — exactly as required by the team's role instructions.
---

# Skill: Raise PR

You are a Builder agent preparing to raise a pull request. Follow every step below in order. Do not skip steps. Do not raise the PR until all steps are complete.

---

## Step 1 — Pre-flight verification

Before writing the PR description, confirm all of the following are true. If any item fails, fix it before proceeding.

- [ ] The code compiles with no errors
- [ ] Lint passes (`run the project's lint command`)
- [ ] All pre-written QA tests pass
- [ ] All pre-existing tests still pass
- [ ] You are on the correct feature branch (`feature/<task-id>-<short-description>`)
- [ ] You have not touched files outside your task scope (if you did, it must be noted in the PR)

---

## Step 2 — Write the PR description

Use the exact structure below. Do not omit any section. Fill every field honestly.

---

### What was built

One to three sentences. State what feature or behavior this PR delivers. Be specific — reference the task ID and the acceptance criteria it satisfies.

---

### ASSUMPTIONS

List every assumption you made that was not explicitly stated in the task brief, `ARCHITECTURE.md`, `INTERFACES.md`, `UX_GUIDELINES.md`, or `PATTERNS.md`. If you made no assumptions, write: `None.`

Format:
```
- [Assumption 1]: [brief rationale]
- [Assumption 2]: [brief rationale]
```

---

### Deviations from task brief

List any way in which your implementation differs from what the task brief specified. For each deviation, state why. If there are none, write: `None.`

---

### Blocking flags

#### INTERFACES.md change required?
If your implementation requires a change to `INTERFACES.md`, write:

> ⛔ BLOCKING: Interface change required — [describe the change needed]. Do not merge until Architect resolves.

If no interface change is needed, write: `No interface changes required.`

#### UX_GUIDELINES.md change required?
If your implementation requires a UX decision not covered by `UX_GUIDELINES.md`, write:

> ⛔ BLOCKING: UX guideline gap — [describe the uncovered decision]. Do not merge until Designer resolves.

If no guideline gap exists, write: `No UX guideline gaps.`

---

### Spark disclosure

If you used Codex-Spark for any part of this PR, list each use:

```
- File/section: [filename or description]
  Spark used for: [what was generated]
  Verification performed: [what you checked — types, error handling, edge cases, naming consistency]
```

If Spark was not used, write: `Spark not used in this PR.`

---

## Step 3 — Complete the self-review checklist

For each item, mark ✔ (pass) or ✘ (fail). A ✘ is not automatically a blocker, but you **must** provide an explanation for every ✘. A missing checklist is an automatic blocker.

```
SELF-REVIEW CHECKLIST
─────────────────────────────────────────────────────
Matches ARCHITECTURE.md patterns          [ ✔ / ✘ ]
  Notes: 

Respects INTERFACES.md                    [ ✔ / ✘ ]
  Notes: 

Respects UX_GUIDELINES.md (if UI task)   [ ✔ / ✘ ]
  Notes: (omit if no UI changes)

Error handling present                    [ ✔ / ✘ ]
  Notes: 

Edge cases considered                     [ ✔ / ✘ ]
  Notes: 
─────────────────────────────────────────────────────
```

---

## Step 4 — Raise the PR

Once the description is written and the checklist is complete, raise the PR against `develop` (not `main`). Set the PR title to:

```
[<task-id>] <one-sentence description of what was built>
```

After raising, post a STATUS_UPDATE to the PM:

```
STATUS_UPDATE
Task ID: <task-id>
Status: in-review
PR: <PR URL or branch name>
Blocking flags: <none / list any ⛔ flags>
```