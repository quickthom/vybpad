# PATTERNS — vYbpad

> Pre-authorized decisions. PM and Builders may apply these without escalating to the Architect. When using a pattern, note which one in your PR description.

---

## PAT-001: Error Handling Shape

All errors surfaced to the user or returned from the API conform to the shapes defined in INTERFACES.md. Apply these rules without escalation:

**API errors:**
- Always return a JSON body with a `code` string discriminant.
- Validation errors include a `fields` map. Validate request bodies with Fastify's JSON Schema validation; transform validation failures into `ValidationError` shape.
- Never expose stack traces or internal error messages in production. Use `INTERNAL_ERROR` with no `message` field in production mode.
- Log the full error server-side (see PAT-006).

**Client-side errors:**
- API errors are caught by the API client module and transformed into typed error objects matching the API error shapes.
- Display user-facing error messages via a toast/notification component. Map error codes to human-readable strings in a single `errorMessages.ts` map — do not scatter message strings across components.
- Network failures (no response) → show "Connection lost. Changes saved locally." and queue for retry.

**Unexpected errors (bugs):**
- Wrap the React app in an ErrorBoundary at the root. Display a "Something went wrong" fallback with a reload button.
- In the canvas editor, catch rendering errors per frame and skip the frame rather than crashing the app.

---

## PAT-002: Naming Conventions

| Context | Convention | Example |
|---|---|---|
| **TypeScript files** | camelCase | `theoryEngine.ts`, `songStore.ts` |
| **React component files** | PascalCase | `TransportControls.tsx`, `ChordPalette.tsx` |
| **Test files** | `*.test.ts` / `*.test.tsx` co-located or in `tests/` mirror | `theoryEngine.test.ts` |
| **TypeScript interfaces/types** | PascalCase, no `I` prefix | `ChordEvent`, `SongData` |
| **TypeScript enums** | PascalCase name, PascalCase members | avoid enums; prefer union types |
| **Functions** | camelCase | `scaleDegreeToMidi`, `getChordTones` |
| **React components** | PascalCase | `EditorCanvas`, `MixerPanel` |
| **Zustand stores** | `use<Name>Store` | `useSongStore`, `usePlaybackStore` |
| **CSS classes** | Tailwind utilities; custom classes in kebab-case if needed | `chord-block`, `note-highlight` |
| **Database columns** | snake_case | `user_id`, `song_data`, `created_at` |
| **API paths** | kebab-case, plural nouns | `/api/projects`, `/api/auth/refresh` |
| **Environment variables** | SCREAMING_SNAKE | `DATABASE_URL`, `JWT_SECRET` |
| **Git branches** | `<phase>/<task-slug>` | `phase-1a/theory-engine`, `phase-2/canvas-renderer` |
| **Constants** | SCREAMING_SNAKE for true constants; camelCase for derived values | `TICKS_PER_QUARTER = 48` |

---

## PAT-003: ID Generation

- All entity IDs (users, projects, measures, chords, notes) are **UUIDs v4**.
- Use `crypto.randomUUID()` (available in Node 19+ and all modern browsers).
- Database PKs use `gen_random_uuid()` (PostgreSQL native).
- Client-generated IDs (for measures, chords, notes in the song document) use `crypto.randomUUID()`.
- IDs are `string` type everywhere — no branded types needed for MVP.

---

## PAT-004: Tick Arithmetic

All beat positions and durations use integer ticks. **48 ticks per quarter note (TPQN).**

| Musical duration | Ticks |
|---|---|
| Whole note | 192 |
| Half note | 96 |
| Quarter note | 48 |
| Eighth note | 24 |
| Sixteenth note | 12 |
| Triplet half | 64 |
| Triplet quarter | 32 |
| Triplet eighth | 16 |
| Dotted half | 144 |
| Dotted quarter | 72 |
| Dotted eighth | 36 |

**Measure length in ticks** = `(numerator / denominator) * 4 * 48`. Examples:
- 4/4 = 192 ticks
- 3/4 = 144 ticks
- 6/8 = 144 ticks
- 2/4 = 96 ticks
- 12/8 = 288 ticks

Builders may define a `tickUtils.ts` helper module with `TPQN`, `measureLengthInTicks(meter)`, `tickToBeat(tick, meter)`, `beatToTick(beat, meter)`, and duration constants. This is pre-authorized.

**MIDI export scaling:** Multiply all tick values by 10 → 480 PPQN for MIDI files.

---

## PAT-005: Immutable State Updates

All Zustand store mutations use **Immer** via the `immer` middleware. Rules:

- Never mutate state directly outside an Immer producer.
- Each mutation that should be undoable must go through the undo middleware (see PAT-009).
- Derived values (e.g., "is the song dirty?", "current key at measure N") are computed selectors, not stored state.
- Avoid storing redundant data. The theory engine computes chord labels, MIDI pitches, and guide tones on-the-fly from the scale-degree data.

---

## PAT-006: Logging Approach

**Server-side:**
- Use Fastify's built-in Pino logger.
- Log levels: `error` (unexpected failures), `warn` (recoverable issues, e.g., expired refresh token reuse), `info` (request lifecycle, auth events), `debug` (query details — off in production).
- Structured JSON format. Include `requestId` from Fastify's request context.
- Never log passwords, tokens, or full request bodies containing credentials.

**Client-side:**
- Use `console.error` for caught exceptions (these surface in browser DevTools and Playwright logs).
- Use `console.warn` for recoverable issues (e.g., sample load fallback).
- No `console.log` in production code. Use a `debug` utility that no-ops in production if verbose logging is needed during development.

---

## PAT-007: API Client Pattern

The client-side API module (`client/src/utils/apiClient.ts`) handles all HTTP communication:

- Uses `fetch` (no Axios needed).
- Automatically attaches `Authorization: Bearer <token>` header from the auth store.
- On 401 response: attempt a single token refresh via `/api/auth/refresh`, then retry the original request. If refresh also fails, redirect to login.
- Returns typed responses matching INTERFACES.md shapes.
- Throws typed error objects (not raw Response objects).

Builders may implement this module without escalation. The shape must match the error types in INTERFACES.md.

---

## PAT-008: Component Structure

**React component rules:**
- One component per file. File name matches component name.
- Props interface defined in the same file (or imported from INTERFACES.md types for shared ones).
- No inline styles. Use Tailwind classes. If a style is truly dynamic and can't be a Tailwind class, use CSS custom properties or a `style` prop with a computed value.
- State that's local to a component stays in `useState`. State shared across components goes in Zustand.
- Side effects (API calls, audio init, event listeners) in `useEffect` with proper cleanup.

**Canvas component rules:**
- The canvas components (`EditorCanvas`, etc.) own a `<canvas>` DOM element via `useRef`.
- Rendering is imperative — called from a `render()` function, not React's render cycle.
- React re-renders update props/state → trigger a `requestAnimationFrame` → call `render()`.
- Mouse events are handled on the canvas element directly (not React synthetic events on child elements — there are none).

---

## PAT-009: Undo/Redo

- Undo stack holds up to **20 snapshots** (matching Hookpad).
- Each undoable action pushes a snapshot of the `measures` array (not the entire store — metadata and band config changes are separate).
- Implemented as Zustand middleware that intercepts mutations marked as undoable.
- `Ctrl+Z` / `Ctrl+Shift+Z` (or `Cmd` on Mac) trigger undo/redo.
- Redo stack is cleared when a new undoable action is performed.
- Non-undoable actions: viewport changes, selection changes, panel toggles, playback state.

Builders may implement the undo middleware using the Immer `Patch` system (record patches + inverse patches per mutation) or full snapshots. Either approach is pre-authorized. Prefer patches if performance is a concern with large songs.

---

## PAT-010: Scale-Degree Color Mapping

Two color schemes, both pre-authorized:

**Diatonic-centric (default):**

| Degree | Color | Hex |
|---|---|---|
| 1 | Red | `#E74C3C` |
| 2 | Orange | `#E67E22` |
| 3 | Yellow | `#F1C40F` |
| 4 | Green | `#2ECC71` |
| 5 | Cyan | `#1ABC9C` |
| 6 | Blue | `#3498DB` |
| 7 | Purple | `#9B59B6` |

**Major-centric:** Colors map to the major scale degrees, regardless of current mode. A `vi` chord in major gets the blue (6) color; a `i` chord in minor also gets blue (6) because its root is the 6th degree of the relative major. Implementation: convert the current scale degree to its major-scale equivalent before indexing the color table.

Chords and notes use the same color for their root scale degree. Builders may refine saturation/lightness to distinguish chords from notes visually, but the hue must follow this table.

Non-diatonic notes (chromatic alterations) use a **muted/desaturated** version of the nearest diatonic degree's color.

---

## PAT-011: Default Voicing Rules (Harmony Track)

For the piano chord backing track:

- **Close voicing**: all chord tones within one octave, centered on the configured voicing octave (default: octave 4).
- **Root position**: lowest note is the root (unless inverted).
- **Inversions**: rotate the bottom N notes up by one octave.
- **Voice leading**: when transitioning between chords, minimize total pitch movement. Prefer common tones held in place; move other voices to the nearest chord tone.
- **Bass track**: plays the chord root (or inversion bass note) one octave below the harmony voicing center.
- **Rhythm**: default is quarter-note chords (one voicing per beat). This matches Hookpad's "Piano RH 1/4s" default.

Builders may implement the voicing engine as a pure function: `(chord: ChordEvent, key, scale, prevVoicing?) → number[]` returning MIDI note numbers. No escalation needed for the algorithm as long as it follows these constraints.

---

## PAT-012: Canvas Rendering Constants

Pre-authorized pixel dimensions for the grid editor (adjustable via zoom, but these are the 1x defaults):

| Constant | Value | Purpose |
|---|---|---|
| `BEAT_WIDTH` | 40px | Width of one quarter-note beat at zoom 1.0 |
| `NOTE_HEIGHT` | 20px | Height of one scale-degree row |
| `CHORD_AREA_HEIGHT` | 40px | Height of the chord staff area |
| `MEASURE_HEADER_HEIGHT` | 24px | Space for measure numbers and change indicators |
| `GRID_LINE_COLOR` | `#E5E7EB` | Beat subdivision lines |
| `BAR_LINE_COLOR` | `#6B7280` | Measure bar lines |
| `PLAYBACK_CURSOR_COLOR` | `#EF4444` | Playback position line |
| `PLAYBACK_CURSOR_WIDTH` | 2px | Cursor line width |
| `SELECTION_COLOR` | `rgba(59, 130, 246, 0.2)` | Selection highlight fill |

The Designer may override these in UX_GUIDELINES.md. Until then, Builders should use these values.

---

## PAT-013: Environment Variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `JWT_SECRET` | yes | — | Min 32 chars; used for access token signing |
| `JWT_REFRESH_SECRET` | yes | — | Separate secret for refresh tokens |
| `PORT` | no | `3001` | API server port |
| `NODE_ENV` | no | `development` | `development` or `production` |
| `CORS_ORIGIN` | no | `http://localhost:5173` | Allowed origin for CORS |
| `VITE_API_URL` | no | `http://localhost:3001` | Client-side API base URL |

Use `.env` files locally (gitignored). Production uses container environment variables. Builders may add variables following this pattern without escalation, but must document them in the PR.

---

## PAT-014: Test File Organization

- **Unit tests** for engine/theory: `client/tests/unit/engine/theory/*.test.ts`
- **Unit tests** for stores: `client/tests/unit/store/*.test.ts`
- **Component tests**: `client/tests/component/*.test.tsx`
- **Canvas tests**: `client/tests/unit/engine/renderer/*.test.ts`
- **API tests**: `server/tests/*.test.ts`
- **E2E tests**: `client/tests/e2e/*.spec.ts` (Playwright)

Each test file mirrors the source file it tests. Builders and QA may create test files in these locations without escalation.

---

## PAT-015: Git Workflow

- `main` — production-ready code. Only the Integrator merges to main.
- `develop` — integration branch. Feature branches merge here via PR.
- Feature branches: `phase-<N>/<task-slug>` (e.g., `phase-1a/theory-engine`).
- Hotfix branches: `fix/<task-id>-<slug>` (e.g., `fix/task-2-8-digit-key`). Use only for patches to `develop` outside normal phase flow.
- One branch per task (per general rules). Branch from `develop`.
- PRs require: description with task ID, ASSUMPTIONS block, self-review checklist, Spark disclosure if applicable.
- Merges are squash-merge to `develop`, preserving a clean history.

---

## PAT-016: Shared Type Imports

All types defined in INTERFACES.md live in the `@vybpad/shared` package. Import convention:

```typescript
import type { SongData, ChordEvent, NoteEvent } from "@vybpad/shared";
```

Never duplicate these types in client or server packages. If a type is needed in only one package, define it locally. If it crosses the boundary, it belongs in `@vybpad/shared` and must be added via an Architect escalation (since it modifies the shared interface).

---

## PAT-017: Git Worktrees for Parallel Tasks

**Multiple Builders must NEVER share a single working directory.** When two or more tasks run in parallel, each Builder must operate in an isolated git worktree.

**Worktree setup (PM responsibility before spawning parallel Builders):**

```bash
# Create a worktree directory
mkdir -p /home/thom/py/vYbpad-worktrees
# Create a worktree for a feature branch
git worktree add /home/thom/py/vYbpad-worktrees/<branch-slug> <branch-name>
```

**Conventions:**
- Worktree root: `/home/thom/py/vYbpad-worktrees/`
- Worktree per branch: `/home/thom/py/vYbpad-worktrees/<task-slug>/`
- The main worktree (`/home/thom/py/vYbpad`) stays on `develop` and is used by the PM and Integrator only
- Each Builder's task brief must specify the `working_directory` for their worktree
- After a task's PR is merged, clean up: `git worktree remove /home/thom/py/vYbpad-worktrees/<task-slug>`

**When tasks are sequential** (no overlap), a single worktree is acceptable — just check out the new branch. But if two tasks might overlap in time, always use separate worktrees.

**After `npm install`:** Each worktree needs its own `npm install` since `node_modules` is not shared across worktrees. Builders must run `npm install` as their first step.

---

## PAT-018: Chromatic Note Display

When a note has a non-zero `chromatic` offset:
- Flat (chromatic = -1): display `♭` before the scale degree number
- Sharp (chromatic = +1): display `♯` before the scale degree number
- The note block uses a desaturated version of the diatonic degree's color (see PAT-010)
- In the canvas editor, chromatic notes are rendered at half-step positions between diatonic rows

Builders may implement the chromatic row positioning as: `baseY + (chromatic * NOTE_HEIGHT / 2)`. This is pre-authorized.

---

## PAT-019: System Package Installation

Agents can install system packages using `yay` (the AUR helper). This does not require `sudo` and works from agent shell sessions. Use `yay -S --noconfirm <package>` for non-interactive installs. Do not use `sudo pacman` — it will fail in agent contexts because no TTY is available for the password prompt.

---

## PAT-020: Commit Message Format

All commits use this format:

```
<type>(<task-id>): <short description>
```

- **Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`
- **Task ID:** The task identifier from the brief (e.g., `TASK-3.1`)
- **Description:** Imperative mood, lowercase, no period, max 72 chars

Examples:
- `feat(TASK-2.7): add mouse drag interaction for note resize`
- `fix(TASK-2.8): correct digit-key input for scale degrees`
- `test(TASK-2.14): add canvas renderer draw-call assertions`

The Integrator's squash-merge message must also follow this format, using the primary task ID. If a squash covers multiple tasks, list them: `feat(TASK-2.4, TASK-2.5): add chord and note block renderers`.

A pre-commit hook (commitlint or equivalent) is authorized — DevOps may add one at the PM's discretion.

---

## PAT-021: Pre-Flight Interface Check

Before issuing each task brief, the PM must verify that every function, prop, type, and store method the Builder will need already exists in INTERFACES.md. If any are missing, escalate to the Architect **before** the Builder starts.

This shifts interface drift from reactive (caught in review) to proactive (caught in planning). The two unplanned INTERFACES.md modifications during Phase 2 (TASK-2.9, TASK-2.11) would have been avoided by this check.

---

## PAT-022: State File Archiving

At each milestone boundary, the PM moves completed-phase detail out of `TASK_STATUS.md` into `TASK_STATUS_ARCHIVE.md`. The active file retains only:
- The current phase's full task table
- A one-line summary per completed phase with a pointer to the archive

```markdown
## Completed Phases
- Phase 0 (7/7), Phase 1A (7/7), Phase 1B (6/6), Phase 2 (15/15) — see TASK_STATUS_ARCHIVE.md
```

Same treatment applies to `PM_STATE.md`: retrospective content that has been actioned moves to an archive section or file.

---

## PAT-023: Tech Debt Cleanup

At the start of each new phase, the PM creates a dedicated cleanup task to resolve carried-over follow-ups before new feature work begins. Follow-ups are collected from:
- Reviewer comments marked as non-blocking
- Stale code comments referencing resolved escalations
- Accumulated minor drift items

The cleanup task is assigned to a Builder and reviewed like any other task. It does not block feature work but should be merged early in the phase.

---

## PAT-024: Expanded Spark Eligibility (Temporary)

**Status:** Active while Codex-Spark is $0.00/token. When pricing changes, the Architect will reassess. Fallback: revert to boilerplate-only (the original Codex-Spark.md policy).

**Policy:** Spark eligibility is expanded from boilerplate-only to **any self-contained subtask whose interface is fully specified** in the task brief or INTERFACES.md. Both Builders and QA agents may invoke Spark via the `invoke-spark` skill.

**Rationale:** At zero cost and ~1,200 tokens/second throughput, the cost/quality tradeoff that justified limiting Spark to boilerplate no longer applies. The only real cost is review time on the receiving agent, and the hard discard rule bounds that cost.

**Rules:**
- The "never" list is unchanged: no auth, no security, no cross-service logic, no project-wide-state-dependent code.
- One Spark attempt per subtask. No parallel runs on the same subtask.
- **Hard discard rule:** If the reviewing agent spends more than a few minutes making structural corrections to Spark output, discard it and write from scratch. Spark's value is speed — heavy surgery is slower than a clean rewrite.
- All Spark use must be disclosed in the PR per the `invoke-spark` skill (Step 4).

---

## PAT-025: State File Update Frequency

State files (`TASK_STATUS.md`, `PM_STATE.md`, `ARCHITECT_STATE.md`) exist for **recovery from interruptions**, not real-time tracking. Interruptions are predictable — the HITL signals in advance. Write state files at batch boundaries and on HITL request, not after every event.

### TASK_STATUS.md (two-section format)

The file has two sections with different access patterns:

1. **Status table** (top) — compact, one row per task. Read when you need the big picture. Update at batch boundaries: after issuing a wave of briefs, after an Integrator session, at milestone close, on HITL request. Exception: blocked tasks should be reflected promptly.

2. **Event log** (bottom, append-only) — one line per event. Append on every status change. No file read required — replace the `<!-- LOG END -->` sentinel with `new line + sentinel`. This is one StrReplace of a known string.

### PM_STATE.md and ARCHITECT_STATE.md

Update on HITL request, before a known interruption, or at milestone close. Do not update after routine events.

---

## PAT-026: Playback Initialization Lifecycle

For Phase 4 playback work, use this canonical store-level audio initialization contract:

- `initStatus` state machine: `"locked" -> "initializing" -> "ready"` or `"error"`.
- `initializeAudio()` is **idempotent** and safe to call multiple times; once `"ready"`, it resolves immediately.
- `initializeAudio()` must be called from a **direct user gesture handler** (click/key/tap), not from autoplay effects.
- While `"initializing"`, block duplicate init calls and keep transport controls non-reentrant.
- On init failure, set `initStatus: "error"` and one of `initErrorCode` values from `PlaybackInitErrorCode`.
- `clearInitError()` only clears the stored error and returns status to `"locked"`; it does not auto-retry.
- `play()` is transport-only; it must not hide initialization side effects. UI or controller code explicitly calls `initializeAudio()` before `play()` on first-run paths.
- `TransportControlsProps` carries `initStatus` and `initErrorCode` so controls can render lock/loading/error affordances without reaching into store internals.
- Do not add a separate `isBootstrapping` prop to shared interfaces; derive it at the boundary as `initStatus === "initializing"` to avoid duplicated state contracts.

---

## PAT-027: Streaming Review/Remediation Orchestration

**The delivery pipeline operates per-PR as a streaming system.** Each PR moves through its own lifecycle independently: `Builder/QA → Reviewer → Remediation → Re-review → Approved`. No "wait for all PRs in wave" barrier. Only integration remains batched at milestone/wave boundaries.

### Ownership continuity

Default to same owners for speed and context retention:

| Role | Default owner | Fallback |
|---|---|---|
| Remediation | Original Builder for the task branch | PM must include prior review summary and delta in new Builder brief |
| QA support during remediation | Original QA (when blocker scope impacts tests) | PM must include prior test coverage plan in new QA brief |
| Re-review | Same Reviewer who issued the blockers | PM must include prior review summary and delta changes in new Reviewer brief |

### Context-degradation circuit breakers

Continuity is revoked for a PR when **any** trigger fires:

1. Same blocker (or equivalent defect) appears in two consecutive review rounds.
2. Blocker count does not decrease after one remediation cycle.
3. Reviewer feedback becomes contradictory across rounds.
4. Two blocked re-review rounds on one PR (hard cap).

When triggered:
- Rotate **Reviewer first** if issue appears to be feedback consistency.
- Rotate **Builder first** if issue appears to be implementation quality.
- Optionally run one tie-breaker second review for contentious cases.

### QA/Builder handshake gate

A PR is not review-ready until all of the following are true:
1. QA has sent `tests-written` status on the same branch.
2. Builder has run QA baseline (failing before implementation), then rerun with implementation (passing).
3. Builder pre-flight checklist confirms: QA tests pass, existing suite passes, self-review checklist complete.

PM must enforce this gate before spawning a Reviewer.

### Delta brief (re-round handoffs)

Every remediation or re-review handoff must include:
- Task ID and PR link.
- Prior blocker list (verbatim or concise normalized form).
- What changed since last round.
- What remains open.
- Explicit "do not re-litigate" list for resolved items.

---

## PAT-028: Upstream Change Protection

**Builders must never revert commits they did not author.** A feature branch may contain commits from other roles — QA test commits, upstream merges from `develop`, or Architect-owned document updates. These are not the Builder's to modify.

**Problem this prevents:** An Architect (or PM, or other privileged role) merges a process or doc change to `develop`. A Builder branches from `develop` and the change appears in their PR diff. A Reviewer flags it as out-of-scope. The Builder reverts it. The Architect's decision is silently destroyed.

**Rules:**

| Role | Rule |
|---|---|
| Builder | Never revert, undo, or drop commits you did not author. If a Reviewer flags changes you didn't make, report to the PM — do not act on the feedback yourself. |
| Reviewer | Do not flag upstream changes as irrelevant or instruct the Builder to revert them. Skip Architect-owned files (`ARCHITECTURE.md`, `INTERFACES.md`, `PATTERNS.md`, `UX_GUIDELINES.md`, `.cursor/agents/*.md`) and QA-authored test commits when reviewing a Builder's PR. If an upstream change appears genuinely wrong, route to the PM for the responsible role. |
| PM | If a Reviewer reports a concern about an upstream change, route to the role that authored it. Never instruct a Builder to revert another role's work. |

---

## PAT-029: Playwright E2E Dev Stack Readiness

**Problem:** A single `webServer.url` that only probes the Vite port lets Playwright start while the Fastify API is still booting. Registration and project creation then race the API → flaky `toHaveURL`, autosave `waitForResponse`, and API contract checks.

**Rule:** In `playwright.config.ts`, use **two** `webServer` entries (or `PLAYWRIGHT_SKIP_WEBSERVER` with both processes already up): one waits on `GET /api/health` at `PLAYWRIGHT_API_URL` (default `http://127.0.0.1:3001`), one waits on the Vite dev URL (`PLAYWRIGHT_BASE_URL`, default `http://127.0.0.1:5173`). Do not rely on `concurrently` alone as the readiness gate.

**Manual dev:** `npm run e2e:devstack` remains valid for developers who prefer one shell; set `PLAYWRIGHT_SKIP_WEBSERVER=1` when those servers are already running.

---

## PAT-030: Remediation File Ownership (Builder vs QA)

**Problem:** When both Builder and QA are spawned concurrently for a remediation round, both agents may edit the same files — shared E2E helpers, test fixtures, or even the same test specs — producing merge conflicts, duplicated fixes, or silently overwritten work. The event log shows repeated stalls, replacements, and multi-round churn on PR #35 and #36 where this overlap occurred.

**Rule:** During remediation rounds, **Builder and QA have exclusive file scopes.** Neither role may edit files owned by the other without explicit PM coordination.

### Ownership table

| File scope | Owner during remediation | Examples |
|---|---|---|
| Application source code | Builder | `client/src/**`, `server/src/**`, `shared/**`, config files (`playwright.config.ts`, `vite.config.ts`, etc.) |
| Test specs and assertions | QA | `**/tests/**/*.test.ts`, `**/tests/**/*.spec.ts` |
| Shared E2E helpers and fixtures | **Builder** (single writer) | `client/tests/e2e/helpers/**`, `client/tests/e2e/fixtures/**` |
| Type stubs / mocks used only by tests | QA | `**/tests/**/__mocks__/**`, test-local type overrides |

### Coordination protocol

1. **PM classifies each blocker** before issuing remediation briefs. Each blocker is tagged as `app` (Builder owns fix), `test` (QA owns fix), or `shared-helper` (Builder owns fix, QA reviews).
2. **Builder pushes first.** When both roles have work, Builder commits and pushes, then signals `REMEDIATION_PUSH` to PM. QA then rebases onto the Builder's push before committing their changes.
3. **No parallel pushes.** Only one role pushes to the PR branch at a time. PM enforces sequencing via the remediation brief ordering.
4. **QA may not modify shared E2E helpers** (`helpers/**`, `fixtures/**`) during remediation. If a helper change is needed to fix a test, QA reports the required change to PM, who includes it in the Builder's remediation brief. This prevents the most common source of overlapping edits.
5. **Builder must not delete or rewrite QA test assertions.** If a test is genuinely wrong (not just failing due to a code bug), Builder reports to PM, who routes to QA.

### PM remediation brief additions

When issuing concurrent Builder + QA remediation briefs, include:

```
File ownership (PAT-030):
  Builder scope: <list of files/directories Builder may edit>
  QA scope:      <list of files/directories QA may edit>
  Push order:    Builder first → QA rebases → QA pushes
```

### Fallback

If a remediation round only has `app`-class blockers, spawn **Builder only** (no concurrent QA). If only `test`-class blockers, spawn **QA only**. Concurrent spawns are only needed when both classes are present.
