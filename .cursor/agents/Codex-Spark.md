---
name: Codex-Spark
model: gpt-5.3-codex-spark-preview
description: >
  A speed tool, not a reasoning tool. Generates first-draft code at ~1,200 tokens/second — which the invoking agent (Builder or QA) then reviews and integrates. Has no awareness of the project, the architecture, or prior context.
---

### Temporary Policy: Expanded Eligibility

Spark is currently **$0.00/token** (input and output). This is temporary. While it lasts, Spark eligibility is expanded beyond boilerplate to any self-contained subtask with a fully specified interface. When pricing changes, revert to boilerplate-only (the Architect will reassess). See PAT-024.

### When to Invoke

**Appropriate** — any self-contained subtask whose interface is fully specified in the task brief or INTERFACES.md:
- CRUD endpoint boilerplate
- Form and input components
- TypeScript type/interface definitions
- Test stubs, fixture files, and **full test implementations** with specific acceptance criteria
- Config file scaffolding
- Migration skeletons (structure only, not logic)
- Layout variations for the invoking agent to choose from
- **Pure-function implementations** where signature, inputs, outputs, and constraints are explicit (store mutations, utility functions, renderer helpers)
- **React components** with well-defined props and documented behavior
- **Any single-file unit** where the brief provides enough context for a stateless agent to produce a correct first draft

**Never invoke for:**
- Authentication or authorization logic
- Security-sensitive code (encryption, input validation, token handling)
- Database migrations with data transformations
- Any logic that spans multiple services
- Anything requiring awareness of project-wide state or prior decisions

### Who May Invoke

Both **Builder** and **QA** agents may invoke Spark via the `invoke-spark` skill. The go/no-go gate, prompting template, and verification checklist apply identically regardless of invoking role.

### How to Prompt Spark Effectively
- Provide the full interface or schema it must conform to (copy from `INTERFACES.md` directly)
- Specify framework, language, and any naming conventions explicitly in the prompt
- Keep the scope to one self-contained unit at a time
- Ask for one thing per invocation — don't ask it to build a whole feature

### Critical Reminders
- Spark has no memory of what it generated in a previous invocation
- Spark scores approximately 56% on complex coding tasks — it will make mistakes
- Every line of Spark output must be read and verified by the invoking agent before commit
- Treat every Spark output as a fast first draft, not a finished artifact
- **Hard discard rule:** If you spend more than a few minutes making structural corrections to Spark output, stop. Discard it and write the implementation yourself. Spark's value is speed — an output that needs heavy surgery is slower than a clean rewrite.
- **One attempt per subtask.** Do not run multiple Spark instances on the same subtask.
