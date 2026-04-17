# UI remediation — Waves 2 and 3 (detailed breakdown)

> Companion to [REF_AUDIT_1.md](REF_AUDIT_1.md) and the Tech Lead sequencing plan ([ui_remediation_sequencing_ec8db0c2.plan.md](../../ui_remediation_sequencing_ec8db0c2.plan.md) at repo root).  
> Canonical stack and contracts: [ARCHITECTURE.md](../../ARCHITECTURE.md), [UX_GUIDELINES.md](../../UX_GUIDELINES.md) §5–7, [PATTERNS.md](../../PATTERNS.md) PAT-012.

**Dependency:** Wave 1 (RA-1, RA-3 — piano roll + horizontal note bars) should be **merged** before starting Wave 2. Wave 3 can start **after** Wave 1; it is sequenced **after Wave 2** in the TL plan to reduce churn on `EditorLayout.tsx` and canvas vertical metrics, but may be parallelized on separate branches if file ownership is proven disjoint (default: **sequential**).

---

## Wave 2 — Chord track strip (RA-2)

### Audit reference

**RA-2.** A dedicated chord track runs along the **very bottom edge** of the main grid area: large Roman-numeral labels (e.g. I, V⁷, vi, IV) with **chord root names below** (e.g. C, G, am, F). Visually distinct from the note-editing area; persistent harmonic summary. Current build: no such track (only measure row / tempo / add / delete).

### Scope

| In scope | Out of scope (defer) |
|----------|----------------------|
| A **dedicated horizontal lane** inside the editor canvas (or tightly coupled canvas+margin) showing **chord timeline** for visible measures | **RA-8** chord discovery tabs (Magic, Popular, …) — Wave 5 |
| Roman numeral + chord symbol/root labeling consistent with theory engine output ([theoryEngine](../../client/src/engine/theory/), [chordBlocks.ts](../../client/src/engine/renderer/chordBlocks.ts) patterns) | Right-panel chord properties (RA-4) — Wave 4 |
| Layout respects [PAT-012](../../PATTERNS.md) `CHORD_AREA_HEIGHT`, [UX_GUIDELINES.md](../../UX_GUIDELINES.md) §6 chord block geometry, and [ARCHITECTURE.md](../../ARCHITECTURE.md) canvas layer order | Full toolbar / MeasureBar redesign (RA-9–11) — Wave 6 |

### Intended end state

1. **Visual separation:** The user clearly sees three vertical regions: (a) measure header, (b) **melody / piano-roll** note area (Wave 1), (c) **chord strip** summarizing harmony, distinct from (b).
2. **Content:** Each chord event in the visible range is represented in the strip with **Roman numeral** (and quality where relevant) and **root/chord name** line per audit — typography per UX §2 canvas table where applicable.
3. **Time alignment:** Strip content aligns horizontally with the same tick ↔ pixel mapping as chord blocks / grid ([layout.ts](../../client/src/engine/renderer/layout.ts), `absoluteTickToViewportX`, `pixelsPerTick`).
4. **No regression:** Wave 1 note rendering and hit-testing remain correct; chord strip does not consume the note pitch grid.

### Workstreams (recommended order)

1. **Layout contract** — Fix vertical stacking: `MEASURE_HEADER_HEIGHT`, melody region height (scrollable), **`CHORD_AREA_HEIGHT`** strip height, total canvas height, and `scrollY` behavior so the strip stays **pinned to the visible bottom** of the editor viewport (or scrolls as one unit with the grid — match reference behavior; document choice in PR).
2. **Render path** — Either extend [drawChordBlocks](../../client/src/engine/renderer/chordBlocks.ts) with a **strip mode** / second pass, or add `drawChordStrip` that only reads `ChordEvent`s and draws in the bottom band. Reuse Roman/name helpers from existing chord drawing to avoid duplicate theory.
3. **Z-order** — Align with ARCHITECTURE canvas stack: grid → chord layer → notes → overlays; strip may be **part of chord layer** or **between** grid and notes per reference — must be explicit so selection/highlight stays correct.
4. **Hit testing (optional for Wave 2)** — If reference implies clicking the strip to select chords, add hit-test for strip rects; if audit is **display-only** for this wave, document **read-only strip** and defer selection to a later wave.

### Primary files (expect edits)

- [EditorCanvas.tsx](../../client/src/components/editor/EditorCanvas.tsx) — canvas dimensions, paint order, possibly separate buffer or clip region for strip.
- [chordBlocks.ts](../../client/src/engine/renderer/chordBlocks.ts), [layout.ts](../../client/src/engine/renderer/layout.ts), [constants.ts](../../client/src/engine/renderer/constants.ts).
- [hitTest.ts](../../client/src/engine/renderer/hitTest.ts) — only if strip is interactive.
- Tests under [client/tests/unit/engine/renderer/](../../client/tests/unit/engine/renderer/).

### Acceptance criteria (Reviewer-ready)

1. With a project containing **multiple chords** across measures, the **bottom chord track** shows Roman + name labels **aligned in time** with the grid.
2. The strip is **visually distinct** from the note piano-roll area (background, border, or vertical spacing per UX §6).
3. No overlap that hides **note** horizontal bars from Wave 1.
4. Full local CI green (`./scripts/ci-local.sh` per [CI_LOCAL.md](../CI_LOCAL.md)).

### QA package

- **Unit:** For fixed `SongData` + `Viewport`, assert strip layout rects or draw calls for at least two chords in different measures.
- **E2E (if available):** Screenshot or assertion that chord strip region contains expected text for seeded project.

### Interfaces and escalation

- **Default:** No [INTERFACES.md](../../INTERFACES.md) change if only rendering/layout.
- **Escalate** if chord strip requires new **shared** types for “display row” or if Roman spelling disagrees with **theory engine** — TL + Designer if UX §6 conflict.

### Briefing note (token efficiency)

- Task ID + **RA-2 only**; link this section + `REF_AUDIT_1.md` §Severity 5.

---

## Wave 3 — Left panel entry (RA-5, RA-6)

### Audit reference

**RA-5.** Reference: chord view has a **Duration** field; melody view has a **vertical duration selector** (1/4, 1/2, 1, 2, ADD) with **Split** and **Tie**. These set duration **before** placing notes/chords. Current build: no duration controls in the left panel (internal state may exist — e.g. `currentDurationTicks` in [EditorLayout.tsx](../../client/src/app/EditorLayout.tsx) passed to [EditorCanvas](../../client/src/components/editor/EditorCanvas.tsx)).

**RA-6.** Reference melody: **C D E F G A B** + **rest**, “Notes in C major” header, **Chromatic** toggle, plus **Raise/Lower** (half, whole, octave). Current build: no left-panel note entry buttons.

### Scope

| In scope | Out of scope (defer) |
|----------|----------------------|
| **Expose** duration selection in the **left panel** UI for both melody and chord entry contexts, wired to the same duration state used for placement | Full **Split/Tie** semantics if not already in song store — implement UI + wire to existing actions, or stub with ⛔ if store lacks ops (TL adjudicates) |
| **Melody:** pitch class buttons + rest, chromatic mode, octave / step nudge buttons per audit | **RA-4** right-panel voice properties |
| Wiring through existing editor commands / `ChordPalette` / keyboard pipeline — minimize new global state | **RA-8** discovery tabs |

### Intended end state

1. User can set **placement duration** from the left panel without relying on hidden keyboard shortcuts; control reflects **current** `currentDurationTicks` (or equivalent) and updates it.
2. User can **insert diatonic pitch classes** (and rest) from buttons; **Chromatic** toggles alternate spelling / chromatic rows per existing PAT-018 behavior.
3. **Raise/Lower** buttons adjust upcoming note pitch or selection per product rules (match Hookpad-style behavior documented in task brief; must call existing store mutations).

### Workstreams (recommended order)

1. **Duration UI (RA-5)** — Add chord-mode “Duration: N” and melody-mode vertical preset list + ADD/Split/Tie row. Bind to `setCurrentDurationTicks` / shared UI store from [EditorLayout.tsx](../../client/src/app/EditorLayout.tsx). Use [UX_GUIDELINES.md](../../UX_GUIDELINES.md) §5 buttons/inputs.
2. **Note entry UI (RA-6)** — New sub-section in [ChordPalette.tsx](../../client/src/components/panels/ChordPalette.tsx) or sibling component (e.g. `MelodyEntryPanel`) imported by `EditorLayout`, shown when entry mode is melody/table as appropriate.
3. **Actions** — Map button clicks to existing `onNoteEdit` / palette payloads / shortcut commands; avoid duplicating logic that already lives in [editorKeyboardLogic](../../client/src/components/editor/editorKeyboardLogic.ts).
4. **Accessibility** — §9: labels, `aria-pressed` on toggles, keyboard focus order.

### Primary files (expect edits)

- [EditorLayout.tsx](../../client/src/app/EditorLayout.tsx) — layout, state wiring, which panel shows melody vs chord tools.
- [ChordPalette.tsx](../../client/src/components/panels/ChordPalette.tsx) and/or new panel component under [client/src/components/panels/](../../client/src/components/panels/).
- [EditorCanvas.tsx](../../client/src/components/editor/EditorCanvas.tsx) — only if duration plumbing needs prop changes.
- Component tests: [client/tests/component/](../../client/tests/component/).

### Acceptance criteria (Reviewer-ready)

1. Changing duration in the **left panel** updates placed **note/chord length** for subsequent placements (verify with a short E2E or component test).
2. Clicking **pitch buttons** (and rest) adds or arms notes consistent with **active measure / selection** rules (document exact behavior in PR ASSUMPTIONS).
3. **Chromatic** and **Raise/Lower** controls produce expected pitch alterations when compared to baseline keyboard-only behavior.
4. No regression to chord palette **diatonic/borrowed** flows.

### QA package

- **Component tests:** Duration control updates displayed value; at least one melody button fires handler with expected degree/rest.
- **E2E (optional):** User sets duration → places note → note width matches duration (ties into Wave 1 visuals).

### Interfaces and escalation

- If **Split/Tie** require new `NoteEditAction` variants or [INTERFACES.md](../../INTERFACES.md) changes — **TL must update INTERFACES first**; Builder does not add contracts unilaterally.
- If reference **ADD** duration semantics are ambiguous vs PAT-004 tick table — brief cites PAT-004 and ASSUMPTIONS.

### Briefing note (token efficiency)

- Single task **RA-5 + RA-6**; link this doc + `ChordPaletteProps` / relevant INTERFACES sections only.

---

## Cross-wave notes

| Topic | Wave 2 | Wave 3 |
|-------|--------|--------|
| Main risk | Canvas height / scroll interaction with strip | `EditorLayout.tsx` merge conflicts |
| Typical branch | `phase-8/ui-chord-strip` (example) | `phase-8/ui-left-entry` |
| Parallelism vs Wave 1 | After W1 merge | After W1 merge; after W2 if avoiding layout thrash |

---

*Last updated: 2026-04-16 — Tech Lead planning artifact.*
