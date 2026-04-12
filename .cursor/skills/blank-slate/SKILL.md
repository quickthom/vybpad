---
name: blank-slate
description: Provide a minimal, opinionated project scaffold and initial prompts. Use when the user asks for a blank project starter, a minimal repository skeleton, or an initial bootstrap for a new project.
---

# Blank Slate

## Quick start

When asked to create a new project scaffold, follow these steps:

1. Ask for the target language/framework (e.g., Python, Node, React), project name, and any required files (README, license, gitignore).
2. Offer sensible defaults (project name = directory name, MIT license, standard .gitignore for language).
3. Generate a minimal set of files: README.md, LICENSE (if requested), .gitignore, basic src/ or app/ entry file, and a starter test or requirements file.
4. Provide a short next-steps checklist (install, run, test, open in editor).

## Instructions

- Keep scaffolds minimal and useful — one file per purpose.
- Use widely-adopted defaults (e.g., MIT license, basic README template).
- When language-specific choices exist, ask a single clarifying question rather than many.
- If the user requests opinionated structure, present a short list of two options and let them pick.
- Do not perform destructive actions without explicit confirmation (e.g., overwriting existing files).

## Output templates

Use these concise templates as outputs.

README.md:

```markdown
# {project-name}

Short description.

## Setup

1. Install dependencies
2. Run the app
3. Run tests
```

Python package layout (minimal):

```text
{project-name}/
- README.md
- LICENSE
- .gitignore
- pyproject.toml
- src/{package}/__init__.py
- src/{package}/main.py
- tests/test_basic.py
```

Node (minimal):

```text
{project-name}/
- README.md
- LICENSE
- .gitignore
- package.json
- src/index.js
- test/test-basic.js
```

## Examples

- User: "Create a blank Python project called `hello-world`."  
  Assistant: Ask whether to include license and testing setup, then create files using the Python layout above and return a one-line run command.

- User: "Bootstrap a React app minimal."  
  Assistant: Confirm whether to use CRA, Vite, or a plain HTML+JS starter; generate the chosen minimal structure and instructions.

## Notes

- Keep the SKILL.md concise (under 500 lines). Put detailed patterns or larger templates in separate reference files only when requested.
- Prefer clarity and actionability: always finish with a short "Next steps" checklist the user can copy-paste.

