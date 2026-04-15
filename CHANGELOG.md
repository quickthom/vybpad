# Changelog

All notable changes to this project are described by **phase milestone** (see [`ROADMAP.md`](ROADMAP.md)). Dates use **2026** where a single calendar day was not recorded in task archives.

---

## Phase 0 — Foundation — 2026

### Added

- Monorepo with **npm workspaces**: `@vybpad/client`, `@vybpad/server`, `@vybpad/shared`.
- Tooling: TypeScript (strict), ESLint, Prettier, Vitest at the root.
- **Client**: Vite 6 + React 18 + Tailwind CSS 4 scaffold.
- **Server**: Fastify + TypeScript scaffold; Prisma schema and initial migration (`User`, `Project`).
- **Shared** package exporting types aligned with [`INTERFACES.md`](INTERFACES.md).
- **Docker Compose**: PostgreSQL 16, API dev container, Vite dev server (`docker-compose.yml`).
- **`UX_GUIDELINES.md`**: designer-owned UI/UX standards.

---

## Phase 1A — Music Theory Engine — 2026

### Added

- Scale/mode definitions (interval arrays for supported modes).
- **`scaleDegreeToMidi`** and chord construction helpers (`chordToMidiNotes`, diatonic quality, inversions).
- Roman numeral generation (`toRomanNumeral`, `toChordName`).
- Borrowed-chord and secondary-chord logic.
- Guide-tone classification (`getGuideCompatibility`, `getChordTones`).
- **`TheoryEngine` facade** and unit tests covering theory functions.

---

## Phase 1B — Auth & API Layer — 2026

### Added

- Auth routes: register, login, refresh, logout; JWT access + refresh flow with **httpOnly** refresh cookie (see `ARCHITECTURE.md`).
- Auth middleware for protected routes.
- **Project CRUD** REST API backed by Prisma.
- **Default song factory** (empty template song for new projects).
- Client **API fetch wrapper** with access-token handling.
- **Server integration tests** for auth and project routes.

---

## Phase 2 — Grid Editor & Song State — 2026

### Added

- **Zustand song store** with Immer and **undo/redo** history middleware.
- **Canvas layout engine**: tick ↔ pixel, pitch ↔ pixel, viewport transforms.
- **Grid rendering**: beat lines, measure bars, measure numbers.
- **Chord blocks**: Roman numeral labels, figured bass, PAT-010 color fills.
- **Note blocks**: degree-based blocks, octave indicators.
- **Hit testing** via spatial index over rendered bounds.
- **Mouse interaction**: select, drag move/resize.
- **Keyboard input**: degrees, durations, navigation/delete (including follow-up fixes for digit-key behavior).
- **Entry modes**: table vs text (`EditorCanvas` integration).
- **Measure bar**: add/delete measures, measure selection.
- **UI store**: viewport, selection, active voice, panel/entry-mode coordination.
- **Guide tone overlay** for chord/scale compatibility highlighting.
- **Color scheme**: diatonic + major-centric (PAT-010).
- **Tests**: canvas renderer draw-call suite; song store mutation and undo/redo coverage.

### Fixed

- Digit-key entry dispatch corrected (reviewer catch; see [PR #17](https://github.com/quickthom/vybpad/pull/17)).

---

## Phase 6 — MIDI Export & StudioOne Integration — 2026-04-15

### Added

- **SMF Type 1** MIDI generation with multi-track scheduling via `MidiExporter` ([PR #53](https://github.com/quickthom/vybpad/pull/53)).
- **Chord names** on a dedicated track as MIDI **text meta events** (FF 01) ([PR #54](https://github.com/quickthom/vybpad/pull/54)).
- **Conductor track** with tempo and time-signature map at measure boundaries ([PR #55](https://github.com/quickthom/vybpad/pull/55)).
- **Drag-to-DAW** MIDI from the transport (full-song export) ([PR #56](https://github.com/quickthom/vybpad/pull/56)).
- Transport **MIDI export UI**: full song vs melody-only (active voice), download plus drag control in `endContent` ([PR #57](https://github.com/quickthom/vybpad/pull/57)).
- **`MidiExporter` integration unit tests** ([PR #58](https://github.com/quickthom/vybpad/pull/58)).

**TASK-6.6** (Studio One live validation) was completed using QA’s HITL protocol; it did not add merged application code.
