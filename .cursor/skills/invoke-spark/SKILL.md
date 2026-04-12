---
name: invoke-spark
description: Use this skill before invoking Codex-Spark for any subtask. Ensures the Builder prompts Spark correctly, scopes the request appropriately, and performs the required verification before committing any Spark-generated output. Also acts as a go/no-go gate — invoke this skill first to confirm Spark is appropriate for the task at hand.
---

# Skill: Invoke Spark

You are a Builder agent considering using the Codex-Spark subagent to accelerate a subtask. Follow this skill in full. Do not invoke Spark until the go/no-go check passes.

---

## Step 1 — Go / no-go check

Spark is a speed tool, not a reasoning tool. It has no memory of the project and scores approximately 56% on complex coding tasks. It will make mistakes.

**Spark is appropriate for:**
- CRUD endpoint boilerplate
- Form and input components
- TypeScript type and interface definitions
- Test stubs and fixture files
- Config file scaffolding
- Migration skeletons (structure only — no data transformation logic)
- Multiple layout variations for the Builder to choose between
- Anything where you already know what the output will look like

**Spark must never be used for:**
- Authentication or authorization logic
- Security-sensitive code (encryption, input validation, token handling)
- Database migrations that include data transformations
- Logic that spans multiple services
- Anything that requires awareness of project-wide state or prior decisions
- Anything that touches or modifies `INTERFACES.md` contracts

If your subtask falls into the "never" list, stop here. Do not invoke Spark. Implement the subtask yourself.

If your subtask is on the appropriate list, continue to Step 2.

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
  - "Generate a form component for the LoginForm props defined above, with field-level validation wiring only — no validation logic"]

DO NOT:
- Invent methods, types, or imports not present in the interface above
- Add validation logic unless explicitly asked
- Use any import not available in [framework/library list]
```

Do not ask Spark to build more than one self-contained unit per invocation.

---

## Step 3 — Verify Spark output before committing

Every line of Spark output must be read and verified. Work through this checklist before integrating any Spark output into your branch:

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