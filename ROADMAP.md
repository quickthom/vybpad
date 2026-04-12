# ROADMAP — vYbpad

> Phased build plan. Read alongside ARCHITECTURE.md and INTERFACES.md.

---

## Dependency Graph (simplified)

```
Phase 0: Foundation
    │
    ├──────────────────┐
    ▼                  ▼
Phase 1A: Theory    Phase 1B: Auth & Data
    │                  │
    ├──────┐           │
    ▼      │           ▼
Phase 2: Editor ◄──── Phase 3: Persistence (save/load)
    │      │
    ▼      ▼
Phase 4: Playback
    │
    ├──────────────────┐
    ▼                  ▼
Phase 5: Advanced    Phase 6: Export
    │                  │
    └──────┬───────────┘
           ▼
Phase 7: Shortcuts & Polish
           │
           ▼
Phase 8: Final QA & Deployment
```

**QA writes tests in each phase**, not as a final phase. Every feature task has a corresponding test task that runs in parallel once the implementation stabilizes.

---

## Phase 0 — Foundation

**Goal:** Monorepo scaffolded, dev environment boots, shared types compile.

| Task | Assignee | Depends on | Parallel with |
|---|---|---|---|
| 0.1 Init git repo, npm workspaces, tsconfig, eslint, prettier | Builder | — | — |
| 0.2 Client scaffold (Vite + React + TypeScript + Tailwind) | Builder | 0.1 | 0.3, 0.4 |
| 0.3 Server scaffold (Fastify + TypeScript) | Builder | 0.1 | 0.2, 0.4 |
| 0.4 Shared types package (`@vybpad/shared`) — all types from INTERFACES.md | Builder | 0.1 | 0.2, 0.3 |
| 0.5 Docker Compose (PostgreSQL + dev servers) | DevOps | 0.2, 0.3 | — |
| 0.6 Prisma schema + initial migration | Builder | 0.3, 0.5 | — |
| 0.7 Designer produces UX_GUIDELINES.md | Designer | — | all above |

**Milestone:** `docker compose up` boots PostgreSQL + API + Vite dev server. `npm test` runs (with zero tests). Shared types import cleanly from both client and server.

---

## Phase 1A — Music Theory Engine

**Goal:** Pure-function theory module passes comprehensive unit tests.

| Task | Assignee | Depends on | Parallel with |
|---|---|---|---|
| 1A.1 Scale definitions (all 9 modes as interval arrays) | Builder | 0.4 | 1A.2, 1B.* |
| 1A.2 `scaleDegreeToMidi` — convert degree+octave+chromatic to MIDI note | Builder | 0.4 | 1A.1, 1B.* |
| 1A.3 Chord construction — `chordToMidiNotes`, diatonic quality, inversions | Builder | 1A.1 | 1B.* |
| 1A.4 Roman numeral generation — `toRomanNumeral`, `toChordName` | Builder | 1A.3 | 1B.* |
| 1A.5 Borrowed chord + secondary chord logic | Builder | 1A.3 | 1B.* |
| 1A.6 Guide tone classification — `getGuideCompatibility`, `getChordTones` | Builder | 1A.3 | 1B.* |
| 1A.7 Unit tests for all theory functions | QA | 1A.1–1A.6 | 1B.* |

**Milestone:** All `TheoryEngine` interface functions implemented and tested. Given any key + scale + chord or note, correct MIDI output and Roman numeral string.

---

## Phase 1B — Auth & API Layer

**Goal:** Users can register, login, and CRUD projects via API.

| Task | Assignee | Depends on | Parallel with |
|---|---|---|---|
| 1B.1 Auth routes (register, login, refresh, logout) | Builder | 0.3, 0.6 | 1A.* |
| 1B.2 Auth middleware (JWT verify, token refresh cookie handling) | Builder | 1B.1 | 1A.* |
| 1B.3 Project CRUD routes | Builder | 1B.2, 0.6 | 1A.* |
| 1B.4 Default song factory (server-side) | Builder | 0.4, 1B.3 | 1A.* |
| 1B.5 API client module (client-side fetch wrapper with auth token handling) | Builder | 1B.1 | 1A.* |
| 1B.6 API integration tests | QA | 1B.1–1B.4 | 1A.7 |

**Milestone:** All auth + project API endpoints pass integration tests. Postman/curl can register, login, create project, get project, update, delete.

---

## Phase 2 — Grid Editor & Song State

**Goal:** User can see a grid, enter chords and notes, edit them, undo/redo.

| Task | Assignee | Depends on | Parallel with |
|---|---|---|---|
| 2.1 Zustand song store (mutations, undo/redo via history middleware) | Builder | 0.4 | 2.2, 2.3 |
| 2.2 Canvas layout engine (tick→pixel, pitch→pixel, viewport transforms) | Builder | 0.4 | 2.1, 2.3 |
| 2.3 Grid background renderer (beat lines, measure bars, bar numbers) | Builder | 2.2 | 2.1 |
| 2.4 Chord block renderer (Roman numeral labels, color fills, figured bass) | Builder | 2.2, 1A.4 | 2.5 |
| 2.5 Note block renderer (colored blocks, octave indicators) | Builder | 2.2, 1A.2 | 2.4 |
| 2.6 Hit testing system (spatial index from rendered rects) | Builder | 2.2 | 2.4, 2.5 |
| 2.7 Mouse interaction — click to place, drag to move/resize, selection | Builder | 2.1, 2.6 | 2.8 |
| 2.8 Keyboard input — 1-7 entry, duration keys, delete, arrow keys | Builder | 2.1 | 2.7 |
| 2.9 Entry modes (table vs text) | Builder | 2.8 | — |
| 2.10 Measure bar component (add/delete measures, selection) | Builder | 2.1 | 2.4–2.9 |
| 2.11 UI store (viewport, selection, active voice, panels) | Builder | 0.2 | 2.1–2.10 |
| 2.12 Guide tone overlay (chord compatibility highlighting) | Builder | 1A.6, 2.5 | — |
| 2.13 Color scheme implementation (diatonic + major-centric) | Builder | 2.4, 2.5 | 2.12 |
| 2.14 Canvas renderer tests (mock context, draw call assertions) | QA | 2.3–2.5 | 2.7–2.9 |
| 2.15 Song store tests (mutations, undo/redo) | QA | 2.1 | 2.14 |

**Milestone:** User opens the app, sees a grid with 8 empty measures, types chords and notes with keyboard, sees colored blocks with Roman numeral labels, can drag to resize, undo/redo works, guide tones highlight when enabled.

---

## Phase 3 — Persistence Layer (Client)

**Goal:** User can save and load projects.

| Task | Assignee | Depends on | Parallel with |
|---|---|---|---|
| 3.1 Auth store + login/register UI (minimal) | Builder | 1B.5, 0.2 | 3.2 |
| 3.2 Project list UI (create, open, delete) | Builder | 1B.5, 0.2 | 3.1 |
| 3.3 Save/load integration (song store ↔ API) | Builder | 2.1, 1B.3, 3.1 | — |
| 3.4 Auto-save (debounced PUT on song change) | Builder | 3.3 | — |
| 3.5 Auth + persistence E2E tests | QA | 3.1–3.4 | — |

**Milestone:** User registers, logs in, creates a project, edits it, sees it auto-save, refreshes the page, logs in again, and finds their work intact.

---

## Phase 4 — Audio Playback

**Goal:** Press play, hear piano chords + melody, see cursor move.

| Task | Assignee | Depends on | Parallel with |
|---|---|---|---|
| 4.1 Tone.js initialization + user gesture handling | Builder | 0.2 | 4.2, 4.3 |
| 4.2 Piano sample loading (smplr SoundFont, lazy load, cache) | Builder | 4.1 | 4.3 |
| 4.3 Harmony voicing engine (chord→piano voicing with voice leading) | Builder | 1A.3 | 4.1, 4.2 |
| 4.4 Song scheduler (song data → Tone.Part per track) | Builder | 4.1, 4.2, 4.3, 1A.2 | 4.5 |
| 4.5 Transport controls UI (play/pause/stop/rewind/tempo) | Builder | 0.2 | 4.1–4.4 |
| 4.6 Playback cursor (overlay canvas, position callback → render) | Builder | 2.2, 4.4 | 4.7 |
| 4.7 Mixer panel UI (volume sliders, mute toggles per track) | Builder | 4.4, 0.2 | 4.6 |
| 4.8 Loop bar (set loop region, loop playback) | Builder | 4.4, 4.6 | 4.7 |
| 4.9 Playback scheduling tests (mocked Tone.js) | QA | 4.3, 4.4 | 4.6–4.8 |
| 4.10 Playback E2E (Playwright: play → cursor moves → notes highlight) | QA | 4.6 | — |

**Milestone:** User enters chords and melody, presses play, hears piano playing chords + melody in sync, cursor tracks position, mixer adjusts volume, loop region works.

---

## Phase 5 — Advanced Music Features

**Goal:** Non-diatonic chords, key/meter changes, multiple voices, chord palette.

| Task | Assignee | Depends on | Parallel with |
|---|---|---|---|
| 5.1 Chord palette UI (diatonic tab with all 7 chords) | Builder | 2.1, 0.2 | 5.2, 5.3 |
| 5.2 Borrowed chord UI (mode selector in chord palette/dialog) | Builder | 1A.5, 5.1 | 5.3 |
| 5.3 Secondary chord UI (V/x, viio/x, IV/x cycle via 'd' key) | Builder | 1A.5, 2.8 | 5.2 |
| 5.4 Inversion cycling ('i' key) + embellishment cycling ('e' key) | Builder | 2.8, 2.1 | 5.1–5.3 |
| 5.5 Key/scale change dialog + measure-level overrides | Builder | 2.1, 2.10 | 5.1–5.4 |
| 5.6 Tempo change + meter change (measure-level) | Builder | 2.1, 2.10 | 5.5 |
| 5.7 Multiple voice support (voice switching Ctrl+1-4, display modes) | Builder | 2.1, 2.5 | 5.1–5.6 |
| 5.8 Playback adaptation (scheduler handles key/tempo/meter changes) | Builder | 4.4, 5.5, 5.6 | 5.7 |
| 5.9 Advanced feature tests | QA | 5.1–5.8 | — |

**Milestone:** User can enter borrowed chords from parallel minor, add V/V secondary dominant, change key at measure 5, switch to 3/4 time at measure 9, write a second melody voice, and play it all back correctly.

---

## Phase 6 — MIDI Export & StudioOne Integration

**Goal:** Export MIDI file that imports cleanly into StudioOne.

| Task | Assignee | Depends on | Parallel with |
|---|---|---|---|
| 6.1 MIDI file generation (multi-track Type 1, 480 PPQN) | Builder | 1A.2, 1A.3, 0.4 | 5.*, 6.2 |
| 6.2 Chord text events in MIDI (chord names as FF 01 meta events) | Builder | 1A.4, 6.1 | 5.* |
| 6.3 Tempo map track | Builder | 6.1 | 6.2 |
| 6.4 Export UI (download button, format selection) | Builder | 6.1, 0.2 | 6.5 |
| 6.5 Drag-and-drop MIDI (browser → desktop) | Builder | 6.1 | 6.4 |
| 6.6 StudioOne import validation | QA | 6.1–6.3 | 6.4, 6.5 |
| 6.7 MIDI generation unit tests | QA | 6.1–6.3 | 6.4, 6.5 |

**Milestone:** User clicks Export, downloads a `.mid` file, drags it into StudioOne, sees melody on one track, chord voicings on another, chord names as markers, correct tempo map. Validate with HITL if chord track auto-population works.

---

## Phase 7 — Keyboard Shortcuts & Polish

**Goal:** Full shortcut parity with Hookpad, polished UI, complete UX.

| Task | Assignee | Depends on | Parallel with |
|---|---|---|---|
| 7.1 Keyboard shortcut manager (centralized handler, conflict resolution) | Builder | 0.2 | 7.2–7.5 |
| 7.2 Note duration shortcuts (h,j,k,l,;,') | Builder | 7.1, 2.8 | 7.3–7.5 |
| 7.3 Split (/), tie (t), triplet (shift+t) operations | Builder | 7.1, 2.1 | 7.2, 7.4 |
| 7.4 Clipboard (copy/paste as JSON, Ctrl+C/V) | Builder | 7.1, 2.1 | 7.2, 7.3 |
| 7.5 Navigation shortcuts (zoom, scroll, selection, playback) | Builder | 7.1 | 7.2–7.4 |
| 7.6 Settings panel (entry mode, labels, colors, guides, staff spacing) | Builder | 0.2 | 7.1–7.5 |
| 7.7 Piano keyboard visualization (optional panel) | Builder | 1A.2, 0.2 | 7.1–7.6 |
| 7.8 UI polish pass (hover states, transitions, tooltips, consistent spacing) | Designer + Builder | 7.1–7.7 | — |
| 7.9 Responsive layout (minimum 1024px width) | Builder | 7.8 | — |
| 7.10 Shortcut E2E tests | QA | 7.1–7.5 | 7.8 |

**Milestone:** Every documented Hookpad keyboard shortcut has a working vYbpad equivalent. UI is visually polished and consistent. Settings panel allows customization.

---

## Phase 8 — Final QA & Deployment

**Goal:** Meet the testing standard, deploy to production.

| Task | Assignee | Depends on | Parallel with |
|---|---|---|---|
| 8.1 Test coverage audit (identify gaps vs testing strategy) | QA | all above | 8.2 |
| 8.2 E2E test suite: full user workflow (register → create → compose → play → export) | QA | all above | 8.1 |
| 8.3 Visual regression baseline (Playwright screenshots of key editor states) | QA | 8.2 | 8.4 |
| 8.4 Accessibility audit (axe-core, keyboard-only navigation for non-canvas) | QA | 7.8 | 8.3 |
| 8.5 Production Docker build (multi-stage, Nginx + Node + PG) | DevOps | 0.5 | 8.1–8.4 |
| 8.6 HTTPS + reverse proxy configuration | DevOps | 8.5 | 8.1–8.4 |
| 8.7 Performance optimization (bundle splitting, lazy loading, sample caching) | Builder | 8.5 | 8.1–8.4 |
| 8.8 Production deployment + smoke test | DevOps | 8.5, 8.6, 8.7 | — |
| 8.9 HITL walkthrough + final acceptance | — | 8.8 | — |

**Milestone:** App is live at a public HTTPS URL. All tests pass. HITL can walk through a full composition workflow with zero bugs in the happy path.

---

## Parallelism Map Summary

| Phase | Can run in parallel with |
|---|---|
| 0 (Foundation) | — |
| 1A (Theory) | 1B (Auth) — fully independent |
| 1B (Auth) | 1A (Theory) — fully independent |
| 2 (Editor) | Late Phase 1B tasks — mostly independent; needs 1A for labels/colors |
| 3 (Persistence) | Phase 2 — needs auth from 1B and store from 2 |
| 4 (Playback) | Phase 3 — needs theory from 1A and editor canvas from 2 |
| 5 (Advanced) | Phase 6 — partially overlapping; advanced features are editor-focused while export is engine-focused |
| 6 (Export) | Phase 5 — needs theory engine but not advanced editor features |
| 7 (Polish) | Late Phase 6 — mostly UI work |
| 8 (QA + Deploy) | DevOps tasks can run in parallel with QA |

**Maximum parallelism** occurs during Phases 1A+1B (two independent tracks) and Phases 5+6 (advanced features + export simultaneously).

---

## Resource Allocation (Suggested)

| Phase | Builders needed | QA needed | Other |
|---|---|---|---|
| 0 | 1–2 | 0 | Designer, DevOps |
| 1A + 1B | 2 (one per track) | 1 | — |
| 2 | 2–3 | 1 | — |
| 3 | 1 | 1 | — |
| 4 | 2 | 1 | — |
| 5 + 6 | 2–3 | 1 | — |
| 7 | 1–2 | 1 | Designer |
| 8 | 1 | 1–2 | DevOps |
