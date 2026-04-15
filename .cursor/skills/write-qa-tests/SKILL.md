---
name: write-qa-tests
description: Use this skill when a QA agent is writing tests for a feature. Guides the agent through translating acceptance criteria and interface contracts into a complete, correctly structured test suite — committed to the right branch before the Builder's PR lands.
---

# Skill: Write QA Tests

You are a QA / Test Writer agent. You have been spawned concurrently with a Builder agent and given the same task brief. Your job is to write a test suite that defines done — before the implementation exists.

Follow every step below in order.

---

## Step 1 — Read your inputs carefully

Before writing a single test, read and understand:

1. **The task brief** — especially the acceptance criteria. Each criterion will become one or more tests.
2. **`INTERFACES.md`** — your tests must verify against these contracts, not against implementation internals.
3. **`ARCHITECTURE.md`** — use the agreed test framework, directory structure, and naming conventions. Do not invent a new pattern.

If you run **full E2E** (`npm run test:e2e` or `./scripts/ci-local.sh`) while another agent uses the same machine, set a **unique Playwright port pair** per worktree (`PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_API_URL`, matching `CORS_ORIGIN` / `VITE_API_URL`) — see **PATTERNS.md** PAT-030.

If an acceptance criterion is untestable as written (vague, subjective, or ambiguous), **flag it to the TL immediately** — do not skip it silently and do not invent an interpretation. Write:

```
UNTESTABLE CRITERION FLAG
Task ID: <task-id>
Criterion: [quote the criterion exactly]
Problem: [why it cannot be verified by a test]
Suggested rewrite: [optional — a version that could be tested]
```

---

## Step 2 — Plan your test coverage before writing

For each acceptance criterion, identify:
- The happy path (expected input → expected output)
- The failure / error path (what should happen when things go wrong)
- Edge cases (empty inputs, nulls, boundary values, maximum limits)
- Any cross-cutting concerns (auth, permissions, rate limiting) if the criterion implies them

Write a brief coverage plan before coding:

```
COVERAGE PLAN — Task <task-id>
───────────────────────────────
Criterion 1: [criterion text]
  - Happy path: [description]
  - Error path: [description]
  - Edge cases: [list]

Criterion 2: ...
```

This plan does not need to be committed — it is thinking scaffolding. But do not skip it.

---

## Step 3 — Write tests against interface contracts, not implementation

This is the most important rule in this skill: **test the contract, not the code.**

- Test that a given input to an API endpoint returns the shape defined in `INTERFACES.md`
- Test that error conditions return the error shape defined in `INTERFACES.md`
- Do not test that a specific internal function was called
- Do not import or reference internal modules that aren't part of the public interface
- Do not write tests that would need to change when the implementation is refactored (while the behavior stays the same)

If you find yourself writing a test that imports a private utility function, stop. Rewrite the test to go through the public interface instead.

---

## Step 4 — Structure your tests

Each test file should follow the conventions in `ARCHITECTURE.md`. In the absence of a project-specific convention, use this structure:

```
describe('<feature name> — <criterion or behavior group>', () => {

  describe('happy path', () => {
    it('<specific expected behavior>', async () => {
      // arrange
      // act
      // assert
    });
  });

  describe('error handling', () => {
    it('returns <error shape> when <condition>', async () => { ... });
  });

  describe('edge cases', () => {
    it('handles empty input gracefully', async () => { ... });
    it('handles null <field> without throwing', async () => { ... });
  });

});
```

Every test must have a description specific enough that a failing test name tells you exactly what broke.

**Do not write:**
```
it('works correctly', ...)
it('handles the response', ...)
```

**Do write:**
```
it('returns 201 and a UserResponse body when valid CreateUserRequest is submitted', ...)
it('returns 400 with a ValidationError body when email field is missing', ...)
```

---

## Step 5 — Commit your tests to the right branch

Check out the Builder's feature branch (`feature/<task-id>-<short-description>`). If it does not yet exist, notify the TL before proceeding — do not create it yourself.
Write your tests in the correct test directory per `ARCHITECTURE.md`. Then run the tests to confirm they fail before committing. This is required — failing tests at commit time prove the tests are genuine verification, not post-hoc approval.

Commit to the feature branch:
```
test(<task-id>): add QA tests for <feature name>

Coverage:
- <criterion 1>: happy path, error path, N edge cases
- <criterion 2>: ...

Status: FAILING (implementation not yet landed — expected)
Do not raise a separate PR. Your tests ride in the Builder's PR.
```

---

## Step 6 — Notify the TL

After committing, send a STATUS_UPDATE to the TL:

```
STATUS_UPDATE
Task ID: <task-id>
Role: QA
Status: tests-written
Branch: feature/<task-id>-<short-description>
Tests written: <number>
Criteria covered: <list the acceptance criteria by number or short name>
Untestable criteria flagged: <none / list>
Note to Builder: QA tests are live on qa/<task-id>. Your PR must pass these tests.
```

---

## Step 7 — Run tests against the Builder's PR

Once the Builder raises their PR:

1. Run your test suite against the Builder's branch.
2. Report results to the TL and Reviewer:

```
QA TEST REPORT
Task ID: <task-id>
Tests run: <number>
Passing: <number>
Failing: <number>

Failures:
- [test name]: [brief description of what failed and why, if diagnosable]

Verdict: PASS / FAIL
```

If tests fail due to a bug in the feature (not a mistake in your test logic), flag it to the TL — do not patch the feature yourself:

```
BUG FLAG
Task ID: <task-id>
Failing test: [test name]
Expected: [what the contract requires]
Actual: [what the implementation returned]
Action needed: Builder re-engagement
```

If a test fails because your test was wrong, fix the test, note the correction in your report, and re-run.