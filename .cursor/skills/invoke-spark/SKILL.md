---
name: invoke-spark
description: Use this skill before invoking Codex-Spark for any subtask. Ensures the invoking agent (Builder or QA) prompts Spark correctly, scopes the request appropriately, and performs the required verification before committing any Spark-generated output. Also acts as a go/no-go gate — invoke this skill first to confirm Spark is appropriate for the task at hand.
---

# Skill: Invoke Spark

You are a Builder or QA agent considering using the Codex-Spark subagent to accelerate a subtask. Follow this skill in full. Do not invoke Spark until the go/no-go check passes.

> **Temporary policy (PAT-024):** Spark is currently $0.00/token and generates at ~1,200 tok/s. Eligibility is expanded beyond boilerplate to any self-contained subtask with a fully specified interface. When pricing changes, the Architect will reassess and may revert to boilerplate-only.

---

## Step 1 — Go / no-go check

Spark is a speed tool, not a reasoning tool. It has no memory of the project and scores approximately 56% on complex coding tasks. It will make mistakes.

**Spark is appropriate for** any self-contained subtask whose interface is fully specified in the task brief or INTERFACES.md, including:
- CRUD endpoint boilerplate
- Form and input components
- TypeScript type and interface definitions
- Test stubs, fixture files, and full test implementations with specific acceptance criteria
- Config file scaffolding
- Migration skeletons (structure only — no data transformation logic)
- Multiple layout variations to choose between
- Pure-function implementations where signature, inputs, outputs, and constraints are explicit (store mutations, utility functions, renderer helpers)
- React components with well-defined props and documented behavior
- Any single-file unit where the brief provides enough context for a stateless agent to produce a correct first draft

**Spark must never be used for:**
- Authentication or authorization logic
- Security-sensitive code (encryption, input validation, token handling)
- Database migrations that include data transformations
- Logic that spans multiple services
- Anything that requires awareness of project-wide state or prior decisions
- Anything that touches or modifies `INTERFACES.md` contracts

If your subtask falls into the "never" list, stop here. Do not invoke Spark. Implement the subtask yourself.

If your subtask fits the eligibility criteria, continue to Step 2.

---

## Step 2 — Construct the Spark prompt

A weak Spark prompt produces output that takes longer to fix than to rewrite. Use this template:

```
FRAMEWORK / LANGUAGE: [e.g., TypeScript, React 18, Next.js App Router]

NAMING CONVENTIONS: [from ARCHITECTURE.md — e.g., camelCase for variables, PascalCase for components]

INTERFACE TO CONFORM TO:
[Paste the relevant section from INTERFACES.md verbatim. Do not paraphrase.]

TASK:
[One self-contained unit only. Be specific. Examples:
  - "Generate a TypeScript interface for the UserProfile schema defined above"
  - "Scaffold a POST /api/users endpoint handler that accepts the CreateUserRequest shape above and returns UserResponse"
  - "Generate a form component for the LoginForm props defined above, with field-level validation wiring only — no validation logic"
  - "Implement the scaleDegreeToMidi function matching the signature above. Input constraints: degree 1-7, octave 0-8, chromatic offset -2 to +2."
  - "Write Vitest tests for the addChord store mutation. Cover: empty measures, duplicate beat position, boundary ticks."]

DO NOT:
- Invent methods, types, or imports not present in the interface above
- Add validation logic unless explicitly asked
- Use any import not available in [framework/library list]
```

Do not ask Spark to build more than one self-contained unit per invocation.

---

## Step 3 — Verify Spark output before committing

Every line of Spark output must be read and verified. Work through this checklist before integrating any Spark output into your branch:

**Hard discard rule:** If you spend more than a few minutes making structural corrections — meaning the output needs logic rewrites, not just typo fixes — stop. Discard the output and write the implementation yourself. Spark's value is speed; an output that needs heavy surgery is slower than a clean rewrite.

**Types and signatures**
- [ ] All types match the shapes defined in `INTERFACES.md` exactly
- [ ] No type is invented that isn't declared somewhere in the project
- [ ] Function signatures match what callers expect

**Imports**
- [ ] Every import resolves to a real package or file in the project
- [ ] No hallucinated method names (e.g., a method called on a library that doesn't expose it)

**Error handling**
- [ ] Error paths are present and handled — not silently swallowed
- [ ] No bare `catch {}` blocks unless explicitly acceptable per `PATTERNS.md`

**Edge cases**
- [ ] Null / undefined inputs are handled
- [ ] Empty arrays / empty strings behave correctly
- [ ] Boundary values are handled

**Naming and conventions**
- [ ] Naming matches the conventions in `ARCHITECTURE.md`
- [ ] File and export names match the project's patterns

**Consistency**
- [ ] No contradictions with other files in your task scope
- [ ] No assumptions that conflict with `ARCHITECTURE.md`

---

## Step 4 — Record Spark use for PR disclosure

After verifying and integrating Spark output, note it for your PR description:

```
Spark used in: [file or section]
Generated: [what Spark produced]
Verification: [which checklist items you caught and corrected, if any]
```

This note goes into the Spark disclosure section of your PR description when you use the `raise-pr` skill.
