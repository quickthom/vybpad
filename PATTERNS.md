# PATTERNS — vYbpad

> Pre-authorized decisions. Builders may apply these without escalating to the Tech Lead (TL). When using a pattern, note which one in your PR description.

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
| **Git branches** | `phase-<phase-id>/<task-slug>` | `phase-1a/theory-engine`, `phase-2/canvas-renderer` |
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

- `main` — production-ready code. Only HITL merges to main.
- `develop` — integration branch. Feature branches merge here via PR.
- Feature branches: `phase-<phase-id>/<task-slug>` (e.g., `phase-1a/theory-engine`, `phase-4/piano-sample-loading`).
- Hotfix branches: `fix/<task-id>-<slug>` (e.g., `fix/task-2-8-digit-key`). Use only for patches to `develop` outside normal phase flow.
- One branch per task (per general rules). Branch from `develop`.
- PRs require: description with task ID, ASSUMPTIONS block, self-review checklist
- Merges are squash-merge to `develop`, preserving a clean history.

---

## PAT-016: Shared Type Imports

All types defined in INTERFACES.md live in the `@vybpad/shared` package. Import convention:

```typescript
import type { SongData, ChordEvent, NoteEvent } from "@vybpad/shared";
```

Never duplicate these types in client or server packages. If a type is needed in only one package, define it locally. If it crosses the boundary, it belongs in `@vybpad/shared` and must be added via TL escalation (since it modifies the shared interface).

---

## PAT-017: Git Worktrees for Parallel Tasks

**Multiple Builders must NEVER share a single working directory.** When two or more tasks run in parallel, each Builder must operate in an isolated git worktree.

**Worktree setup (TL responsibility before spawning parallel Builders):**

Use a dedicated directory **outside** the main clone for additional worktrees. Let `<REPO_ROOT>` be the path to the primary clone (TL workspace, usually on `develop`) and `<WORKTREE_ROOT>` be a directory you choose for parallel worktrees (see [ENVIRONMENTS.md](ENVIRONMENTS.md) for operator conventions).

```bash
mkdir -p <WORKTREE_ROOT>
# From <REPO_ROOT>, on develop:
git worktree add <WORKTREE_ROOT>/<task-slug> <branch-name>
```

**Conventions:**
- Worktree root: `<WORKTREE_ROOT>/` (one directory per operator machine; not committed)
- Worktree per branch: `<WORKTREE_ROOT>/<task-slug>/`
- The main worktree (`<REPO_ROOT>`) stays on `develop` and is used by the TL only
- Each Builder's task brief must specify the `working_directory` for their worktree
- After a task's PR is merged, clean up: `git worktree remove <WORKTREE_ROOT>/<task-slug>`

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

Use non-interactive package installation; see ENVIRONMENTS.md for OS-specific commands. See [ENVIRONMENTS.md](ENVIRONMENTS.md) for OS-specific commands.

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

The TL's squash-merge message must also follow this format, using the primary task ID. If a squash covers multiple tasks, list them: `feat(TASK-2.4, TASK-2.5): add chord and note block renderers`.

A pre-commit hook (commitlint or equivalent) is authorized.

---

## PAT-021 - 025: DELETED.

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

## PAT-027: Keyboard Shortcut Dispatch

Use a single shortcut registry for editor, panel, and transport commands.

- Register normalized chord strings only, in canonical form such as `Ctrl+Shift+T`.
- Scope shortcuts explicitly: `global`, `editor`, `panel`, or `input`.
- Resolve conflicts before dispatch. Prefer the most specific scope, then the most recent registration only when the binding's `conflictPolicy` is `replace`.
- Ignore shortcuts while text is actively being edited, while a modal is open, or while the event is part of IME composition, unless a command is explicitly allowed in that context.
- Dispatch by command id, not by raw key string, after a shortcut is accepted.
- Call `preventDefault()` only after a command is matched and accepted.

## PAT-028: Clipboard Payload Versioning

Use a versioned JSON payload for editor copy/paste so future schema changes stay backward-compatible.

- Include a numeric `version` field on every clipboard payload.
- Keep copied song slices relative to their source selection, not tied to a single absolute editor state snapshot.
- Reject unknown clipboard versions cleanly and treat them as a no-op paste.
- Preserve measure-relative offsets so paste can re-anchor the selection at the destination measure.

---