# Test coverage matrix — requirements & roadmap → test artifacts

**Task:** TASK-8.1 (ROADMAP §8.1 — test coverage audit artifact, Phase A inventory)  
**Branch:** `phase-8/coverage-audit-matrix` (PAT-015)  
**Purpose:** Map major **REQUIREMENTS.md** expectations and **ROADMAP.md** milestones through Phase 7 plus Phase 8 intent to automated test layers and manual (HITL) validation. Contract reference: **INTERFACES.md** (read-only for this audit).

**Columns**

| Column | Meaning |
|--------|---------|
| **Unit** | `client/tests/unit/**/*.test.{ts,tsx}` — Vitest; theory, stores, engine, mock canvas, hooks |
| **Component** | `client/tests/component/**/*.test.tsx` — Vitest + RTL; panels, transport, auth UI, DOM-level behavior |
| **Server** | `server/tests/**/*.test.ts` — Vitest; Fastify routes, auth middleware, integration |
| **E2E** | `client/tests/e2e/*.spec.ts` — Playwright (dual stack per `playwright.config.ts`; port isolation PAT-030) |
| **Manual (HITL)** | Human-in-the-loop; not claimed as CI-automated |

---

## Matrix

| Requirement / milestone | Unit | Component | Server | E2E | Manual (HITL) |
|-------------------------|------|-----------|--------|-----|----------------|
| **REQ — Hookpad-like functionality** (core editor, theory-backed chords/notes, playback) | Broad: `client/tests/unit/engine/theory/*.test.ts`, `songStore*.test.ts`, `renderer/*.test.ts`, `audio/*.test.ts`, `EditorCanvas.*.test.tsx`, etc. | `chordPalette*.test.tsx`, `phase5PaletteSweep.task-5-9.test.tsx`, `TransportControls.task-4-5.test.tsx`, `MixerPanel.task-4-7.test.tsx`, … | — | `persistence.happy.spec.ts`, `phase5-advanced-feature-sweep.task-5-9.spec.ts`, `playback-surface.task-4-10.spec.ts`, `shortcut-manager.phase-7-10.spec.ts` | **gap** for exhaustive parity; acceptance is process + HITL walkthrough (ROADMAP 8.9) |
| **REQ — Secure deployment & internet access** | — | — | Auth/token paths: `auth.routes.test.ts`, `authMiddleware.test.ts`, `api.integration.test.ts` | `persistence.happy.spec.ts` (register/login path) | **HITL** — production TLS, hosting, smoke after deploy (ROADMAP 8.5–8.8); not fully represented in unit tests |
| **REQ — Testing standard** (real DOM & user flows, not props-only) | Renderer/store tests assert behavior via mocks + state | RTL across auth, editor shell, transport, loops, export UI | API integration exercises HTTP surface | Multiple specs hit real browser + API; see **Known gaps** for unified journey | **HITL** — final acceptance session (8.9) |
| **REQ — Appealing, consistent UI** | — | `uiPolish.task-7-8.test.tsx`, `f10-editor-polish-12-15.test.tsx`, `Tooltip.f10-12-15.test.tsx` | — | `viewport-min-width.f07.spec.ts` | **gap** — systematic visual baselines tracked under **TASK-8.3** (pre-audit P1) |
| **REQ — Frictionless StudioOne export** (MIDI handoff) | `client/tests/unit/engine/midi/midiExporter.*.test.ts`, `midiExporter.integration.test.ts` | `MidiExportControls.task-6-4.test.tsx`, `EditorLayout.midiDrag.task-6-5.test.tsx` | — | **gap** — no Playwright spec asserts MIDI download/header in browser (pre-audit P0); see **TASK-8.2** | **HITL — TASK-6.6** — live StudioOne import & chord-track behavior (`TASK_STATUS.md`); DAW validation is **not** automated here |
| **Phase 0 — Foundation** (tooling, workspaces, tests run) | — | — | — | — | Satisfied by repo wiring; **no** dedicated “phase 0” test file row |
| **Phase 1A — Theory engine** | `theoryEngine.test.ts`, `theoryEngineComprehensive.test.ts`, `scaleDegreeToMidi.test.ts`, `romanNumerals.test.ts`, `chords.test.ts`, `borrowedChords.test.ts`, `secondaryChords.test.ts`, `guideTones.test.ts`, … | — | — | Indirect via editor/playback E2E | — |
| **Phase 1B — Auth & project API** | `apiClient.test.ts`, `authStore.test.ts`, `initAuthApiClient.test.ts` | `authForms.test.tsx`, `authRouting.test.tsx` | `auth.routes.test.ts`, `authMiddleware.test.ts`, `project.routes.test.ts`, `defaultSongFactory.test.ts`, `api.integration.test.ts` | `persistence.happy.spec.ts` | — |
| **Phase 2 — Grid editor & song state** | `songStore*.test.ts`, `uiStore.test.ts`, `layoutEngine.test.ts`, `hitTest.test.ts`, `EditorCanvas.*.test.tsx`, `useKeyboard*.test.ts`, … | `MeasureBar.test.tsx`, `EditorLayout.keyboardShortcuts.test.tsx`, `EditorCanvas.accessibility.test.tsx` | — | `persistence.happy.spec.ts`, `shortcut-manager.phase-7-10.spec.ts` | — |
| **Phase 3 — Persistence (client)** | — | `saveLoad.task-3-3.test.tsx`, `projectList.task-3-2.test.tsx`, `autoSave.task-3-4.test.tsx` | Covered by project routes tests | `persistence.happy.spec.ts` | — |
| **Phase 4 — Playback** | `audioEngine.*.test.ts`, `pianoSampleLoader.*.test.ts`, `songScheduler*.test.ts`, `playbackScheduling.task-4-9.test.ts`, `playbackStore.task-4-*.test.ts`, `drawPlaybackCursor.task-4-6.test.ts`, … | `playbackGesture.task-4-1.test.tsx`, `transportPianoSamples.task-4-2.test.tsx`, `TransportControls.task-4-5.test.tsx`, `MixerPanel.task-4-7.test.tsx`, `loopBar.task-4-8.test.tsx` | — | `playback-init.task-4-1.spec.ts`, `piano-samples.task-4-2.spec.ts`, `harmony-voicing-playback.task-4-3.spec.ts`, `playback-surface.task-4-10.spec.ts` | — |
| **Phase 5 — Advanced features** | `songStore.secondaryChord.*`, `songStore.task-5-6.test.ts`, `playbackAdaptation.task-5-8.test.ts`, `phase5MilestonePlayback.task-5-9.test.ts`, … | `chordPalette.task-5-1.test.tsx`, `KeyScaleChangeDialog.task-5-5.test.tsx`, `tempoMeterDialog.task-5-6.test.tsx`, `phase5DialogPrefill.task-5-9.test.tsx`, … | — | `phase5-advanced-feature-sweep.task-5-9.spec.ts` | — |
| **Phase 6 — MIDI export (in-app)** | `midiExporter.task-6-1/2/3.test.ts`, `midiExporter.integration.test.ts` | `MidiExportControls.task-6-4.test.tsx`, `EditorLayout.midiDrag.task-6-5.test.tsx` | — | **gap** (export in real browser session) | **HITL — TASK-6.6** — StudioOne import validation; binary + DAW-specific behavior **not** in CI |
| **Phase 7 — Shortcuts & polish** | `shortcutManager.test.ts`, `durationShortcuts.*`, `navigationShortcuts.*`, `splitTieTriplet*`, `editorUiSettingsLocalStorage.task-7-6.test.ts`, … | `EditorLayout.navigationShortcuts.task-7-5.test.tsx`, `editorSettingsPanel.task-7-6.test.tsx`, `PianoKeyboardPanel.task-7-7.test.tsx`, `uiPolish.task-7-8.test.tsx`, `EditorViewportGate.f07.test.tsx`, … | — | `shortcut-manager.phase-7-10.spec.ts`, `viewport-min-width.f07.spec.ts` | Designer-driven polish sign-off remains **partially** HITL |
| **Phase 8.1 — Coverage audit (this document)** | — | — | — | — | Delivers traceability artifact; optional Vitest coverage report is **gap** / backlog (pre-audit §Phase E) |
| **Phase 8.2 — Full user workflow E2E** | — | — | — | **gap** — single chained register → compose → play → **export MIDI** spec not yet present | N/A |
| **Phase 8.3 — Visual regression baselines** | — | — | — | **gap** — `toHaveScreenshot` / golden dirs not wired per pre-audit | Designer approval for baseline updates |
| **Phase 8.4 — Accessibility audit (axe, keyboard chrome)** | — | `EditorCanvas.accessibility.test.tsx` (limited RTL) | — | **gap** — no `@axe-core/playwright` gate yet | Manual keyboard sweeps beyond automated scope |
| **Phase 8.5–8.8 — Prod Docker, HTTPS, perf, deploy smoke** | — | — | — | — | **HITL / DevOps** — production verification not mapped to unit test paths |

---

## TASK-6.6 / StudioOne — explicit HITL row

| Item | Automation | Rationale |
|------|------------|-----------|
| **TASK-6.6 StudioOne import validation** | **HITL only** | ROADMAP Phase 6 milestone and `TASK_STATUS.md` record live DAW validation outside the repo’s automated suite. MIDI correctness is partially covered by `client/tests/unit/engine/midi/` and export UI by RTL; **import into StudioOne, chord track behavior, and host-specific interpretation** require a human (pre-audit plan Phase B: “Out of scope for automation”). |

This is **not** listed as automated E2E or unit coverage; do not treat DAW validation as a CI substitute.

---

## Known gaps — pre-audit P0 / P1 vs Phase 8 tasks

Cross-reference: Tech Lead pre-audit plan `test_coverage_pre-audit_44b564bb.plan.md` (§3–4); reconcile with this matrix during TASK-8.1 formal audit.

| Priority | Gap | Maps to |
|----------|-----|---------|
| **P0** | Single **unified workflow** E2E: register → create → substantive edit → play → **export MIDI** (download / header / non-empty blob) | **TASK-8.2** (ROADMAP 8.2). Helpers: `client/tests/e2e/helpers/*`, patterns in `persistence.happy.spec.ts`. |
| **P0** | **MIDI export** absent from Playwright suite (covered in Vitest/RTL only today) | Same — **TASK-8.2**. |
| **P1** | **axe-core** (or equivalent) on non-canvas shell: login, project list, panels, transport chrome | **TASK-8.4** (ROADMAP 8.4). Align with `docs/E2E_EDITOR.md` and UX canvas exemption for noisy regions. |
| **P1** | **Visual regression** (`toHaveScreenshot`, stable viewports ≥1024×768) | **TASK-8.3** (ROADMAP 8.3). |
| **P2** | Vitest **coverage** report / optional thresholds; shared `storageState` for E2E scale | Backlog / optional; see pre-audit §Phase E–F. |

---

## Notes

- **Playwright inventory** (this branch): 8 spec files under `client/tests/e2e/` — see pre-audit §1.1 for names and intent.
- **Parallel E2E:** Use unique ports per worktree (**PAT-017**, **PAT-030**); see `docs/E2E_EDITOR.md` and root `README` / `docs/CI_LOCAL.md`.
- **Interfaces:** API and shared types are defined in **INTERFACES.md**; tests should remain aligned as contracts evolve (QA does not edit that file unilaterally).
