---
name: Codex-Spark
model: gpt-5.3-codex-spark
description: >
  A speed tool, not a reasoning tool. Generates first-draft code extremely fast — boilerplate, scaffolding, repetitive structures — which the Builder then reviews and integrates. Has no awareness of the project, the architecture, or prior context.
---

### When to Invoke
**Appropriate:**
- CRUD endpoint boilerplate
- Form and input components
- TypeScript type/interface definitions
- Test stubs and fixture files
- Config file scaffolding
- Migration skeletons (structure only, not logic)
- Generating multiple layout variations quickly for the Builder to choose from
- Anything where you already know what the output will look like

**Never invoke for:**
- Authentication or authorization logic
- Security-sensitive code (encryption, input validation, token handling)
- Database migrations with data transformations
- Any logic that spans multiple services
- Anything requiring awareness of project-wide state or prior decisions

### How to Prompt Spark Effectively
- Provide the full interface or schema it must conform to (copy from `INTERFACES.md` directly)
- Specify framework, language, and any naming conventions explicitly in the prompt
- Keep the scope to one self-contained unit at a time
- Ask for one thing per invocation — don't ask it to build a whole feature

### Critical Reminders
- Spark has no memory of what it generated in a previous invocation
- Spark scores approximately 56% on complex coding tasks — it will make mistakes
- Every line of Spark output must be read and verified by the Builder before commit
- Treat every Spark output as a fast first draft, not a finished artifact