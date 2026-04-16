# Milestone design review — F-07 (Phase 4 playback close)

**Directive:** F-07 — Phase 4 playback milestone UX review (transport, cursor, mixer, loop)  
**Role:** Designer  
**Branch reviewed:** `develop` at **`1fe1984`** (TASK-4.9 #42 + TASK-4.10 #43 squash-merged; includes full Phase 4.1–4.8 feature set)  
**Scope:** `TransportControls`, `LoopBar`, `MixerPanel`, playback cursor rendering (`drawPlaybackCursor` / `EditorLayout` wiring). Out of scope: theory engine, persistence flows (covered in F-06), Phase 5+.

---

## Summary — shipped UX vs `UX_GUIDELINES.md` & `ROADMAP.md` Phase 4

### Aligned with `UX_GUIDELINES.md`

| Area | Evidence |
| --- | --- |
| **§1 Tokens** | Transport, loop bar, mixer use `var(--color-*, #hex)` fallbacks consistent with token table (`TransportControls.tsx`, `LoopBar.tsx`, `MixerPanel.tsx`). |
| **§3 Layout / transport row** | `TransportControls`: `min-h-12`, `border-b`, `px-4`, grouped playback + tempo — matches structural transport band (§3 table: 48px-class row). |
| **§5.5 Sliders** | `MixerPanel`: range inputs with `aria-label` per track, percentage readout, `min-h-11` rows — slider/track layout per panel guidance. |
| **§5.8 Transport** | `role="toolbar"` `aria-label="Transport"`; play/pause/stop/rewind; tempo number input with label; initializing spinner + “Loading piano samples…”; `aria-live` on beat readout; `data-audio-ready` for E2E; init errors `role="alert"`. TASK-4.10: `data-testid="vybpad-transport-current-beat"` on readout container (automation hook without changing §9 semantics). |
| **§6 Canvas — playback cursor** | `drawPlaybackCursor.ts`: full-height vertical line via `PLAYBACK_CURSOR_COLOR` / `PLAYBACK_CURSOR_WIDTH` from renderer constants; positioned with `absoluteTickToViewportX` — documented in file header as UX §6. |
| **§9 Focus** | Transport, loop, mixer buttons: `focus-visible:ring-2` + offset using `--color-focus-ring`. |
| **Loop bar (TASK-4.8)** | `role="group"` with stable `aria-labelledby`; tick inputs `h-10`, sr-only hint for PAT-004 ticks; `sr-only` `role="status"` `aria-live="polite"` announces loop on/off and region; **Clear loop** disabled when not looping with `aria-disabled`. |
| **Mixer (TASK-4.7)** | `h3` “Mixer” per §2 heading hierarchy; scrollable track list `overflow-y-auto`; mute `aria-pressed`; Mute control `h-11 w-11` meets ≥44px touch target. |
| **ROADMAP Phase 4 milestone** | Play, audible harmony/melody, cursor motion, mixer, loop region — all present in shipped chrome + engine. |

### Partially aligned or scope notes

| Topic | Status |
| --- | --- |
| **§5.8 — beat readout vs canvas cursor** | **Partial for automation.** E2E (TASK-4.10) asserts **transport `M:B` readout** change; canvas cursor is not DOM-accessible. Acceptable: same `playbackTick` drives both; document for QA/Builder. |
| **§6 — active-note/chord highlight at `playbackTick`** | **Not verified as DOM/canvas assertion in this review.** `UX_GUIDELINES.md` §6 describes optional highlight styling; confirm in renderer implementation vs guideline (amber outline) in a future focused pass if not already unified. |
| **Transport touch targets** | Buttons remain **`h-10` (40px)** visual height; same note as F-06 — §9 allows 40px with extended hit area; dense toolbar exception or add invisible padding remains an open polish item. |
| **Loop bar — “Set loop” without tick musical framing** | UI uses **raw ticks** (power user / PAT-004 honest); measure:beat mental model not shown in loop fields — acceptable for MVP, optional future: show formatted range. |
| **Mixer — inline `style` on range** | Gradient fill uses **`style={{ background: linear-gradient… }}`** for level visualization — justified for dynamic fill; PAT-008 allows dynamic values when Tailwind cannot express. |

### Gaps and drift

1. **§4 Viewport — editor** — Still only partial vs F-06 recommendation: editor routes may not enforce `useMinViewport1024` everywhere; playback chrome inherits any cramped layout. **Open:** P0 from F-06 remains relevant.  
2. **MeasureBar / EntryModeToggle touch targets** — Carried from F-06; unchanged by Phase 4.  
3. **Loop toggle discoverability** — Loop is a second row (`LoopBar`) without a persistent “loop enabled” visible indicator beyond sr-only live region for sighted users — optional: small badge or icon when `isLooping`.

---

## Recommendations (priority)

1. **P0 — Viewport:** Reuse F-06 P0 — extend minimum-width guard to **editor** shell so transport + grid stay usable.  
2. **P1 — Touch:** Align transport secondary buttons with §9 hit-area guidance or document dense-toolbar exception in `UX_GUIDELINES.md`.  
3. **P2 — Loop UX:** Consider measure:beat display for loop start/end **or** a compact “loop active” chip for sighted users.  
4. **P3 — Playback highlight:** Audit canvas renderer vs §6 “active at playbackTick” outline/tint for chords and notes; align or document deviation.

---

## `UX_GUIDELINES.md` changelog (F-07)

**Version 1.3 (proposed):** No file edit in this commit — milestone records Phase 4 playback surfaces as reviewed. If PM adopts P2/P3, Designer updates `UX_GUIDELINES.md` in a follow-up PR with explicit §5.8/§6 notes for loop row and playback highlight.

---

## Files referenced (evidence)

| Path | Role |
| --- | --- |
| `client/src/components/controls/TransportControls.tsx` | Transport §5.8, TASK-4.1 / 4.10 test ids |
| `client/src/components/controls/LoopBar.tsx` | TASK-4.8 loop region |
| `client/src/components/panels/MixerPanel.tsx` | TASK-4.7 mixer |
| `client/src/app/EditorLayout.tsx` | Wiring, `playbackTick` → canvas + transport |
| `client/src/components/editor/EditorCanvas.tsx` | Cursor overlay invocation |
| `client/src/engine/renderer/drawPlaybackCursor.ts` | Vertical playback cursor §6 |
| `client/src/engine/renderer/constants.ts` | `PLAYBACK_CURSOR_*` |
| `client/tests/e2e/playback-surface.task-4-10.spec.ts` | TASK-4.10 transport readout E2E |

---

## Integration note (PM)

- **PR #42** (TASK-4.9) and **PR #43** (TASK-4.10) squash-merged to `develop` in one integration wave; merge order independent.  
- **Local CI:** `./scripts/ci-local.sh` green on `1fe1984` after ignoring nested **`.worktrees/**` in `eslint.config.js` (operator clones with parallel worktrees).
