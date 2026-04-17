# UI remediation — Waves 7–9 (detailed breakdown)

> Companion to [REF_AUDIT_1.md](REF_AUDIT_1.md), [UI_REMEDIATION_WAVES_4_6.md](UI_REMEDIATION_WAVES_4_6.md), [UI_REMEDIATION_OPERATOR_BACKLOG.md](UI_REMEDIATION_OPERATOR_BACKLOG.md), and [ui_remediation_sequencing_ec8db0c2.plan.md](../../ui_remediation_sequencing_ec8db0c2.plan.md).  
> Canonical contracts: [ARCHITECTURE.md](../../ARCHITECTURE.md), [INTERFACES.md](../../INTERFACES.md), [UX_GUIDELINES.md](../../UX_GUIDELINES.md) §5–7, [PATTERNS.md](../../PATTERNS.md) PAT-012.

**Dependencies:** Wave **6** merged before Wave 7 (palette + hierarchy assume stable shell from RA-9/11/18). Wave **8** depends on **Wave 1** viewport/zoom model (RA-16, RA-21). Wave **9** is cleanup after chord UI and panels are truth-complete.

---

## Wave 7 — Palette density + hierarchy (RA-10, RA-12)

### Audit reference

**RA-10.** Reference chord buttons: **compact, single-column, text-first** rows — Roman numeral left, root/chord name right (e.g. I / C, ii / dm); information-dense. Build: **large colored tiles**, two columns, big scale-degree numerals — visually loud.

**RA-12.** Build exposes **“Cycle secondary (d)”** and **“Clear to diatonic”** as **large** left-panel buttons. Reference tucks **Secondary** and **Borrow From** into **Chord Properties** on the **right** (Wave 4). This wave **demotes or relocates** those controls to match hierarchy.

### Scope

| In scope | Out of scope (defer) |
|----------|----------------------|
| Restyle **diatonic/borrowed chord rows** toward reference density (typography §2, PAT-010 swatches without oversized degree numbers) | New theory features |
| Move **secondary cycle** / **clear borrowed** to right panel or compact **ghost/tertiary** controls if Wave 4 already shipped properties | Re-adding large tiles in a later “mobile” experiment without Designer sign-off |
| Optional **global density** pass (padding, `text-sm` bands) — overlaps [OB-6](UI_REMEDIATION_OPERATOR_BACKLOG.md) | Changing **canvas** `NOTE_HEIGHT` / grid constants without Designer — escalate |

### Intended end state

1. Chord palette reads as **dense list** (reference-like), still meets **touch target** minima where interactive (UX §9 — may use invisible hit extension).
2. **Secondary** and **diatonic reset** no longer dominate the left column; user finds them alongside **Chord Properties** (Wave 4) or equivalent compact pattern.
3. **Degree colors** remain consistent with canvas (PAT-010); no duplicate hex tables in components.

### Workstreams (recommended order)

1. **RA-12 — Hierarchy** — Remove or shrink prominent buttons; wire to existing `cycleSecondaryChordEdit` / clear-borrowed actions from [EditorLayout](../../client/src/app/EditorLayout.tsx) / [ChordPalette](../../client/src/components/panels/ChordPalette.tsx).
2. **RA-10 — Layout** — Replace two-column tile grid with **single-column rows**; Roman + name columns; optional subtle degree color strip **without** oversized numerals.
3. **OB-6 overlap** — If operator backlog **global UI too large** is still open, apply **incremental** tightening here (panel padding, heading sizes) per UX §3; **Designer** if tokens change.

### Primary files

- [ChordPalette.tsx](../../client/src/components/panels/ChordPalette.tsx) (`SecondaryChordInspector` in same file unless split).
- [EditorLayout.tsx](../../client/src/app/EditorLayout.tsx) — button placement, panel sections.
- Wave 4 **properties** component under [panels/](../../client/src/components/panels/) — if RA-12 relocates controls into right panel.

### Acceptance criteria

1. Screenshot or design review: palette **no longer** uses dominant two-column **large** degree tiles for the default diatonic list.
2. **Cycle secondary** / **Clear to diatonic** are **not** primary large CTAs in the left panel (tertiary/compact or relocated).
3. Contrast and PAT-010 alignment pass **Reviewer** checklist (UX §1 tokens).
4. `ci-local` green; RTL tests updated for new DOM.

### QA package

- Component tests: chord row click still selects/applies chord.
- Optional visual snapshot for palette region.

### Escalation

- **Designer** if reference row density conflicts with **44px touch** minimum — document chosen compromise.

### Briefing note

- **RA-10 + RA-12**; cite [REF_AUDIT_1.md](REF_AUDIT_1.md) Severity 3 items verbatim.

---

## Wave 8 — Transport polish + zoom + tempo placement (RA-13, RA-14, RA-16, RA-20, RA-21) + RA-15 gate

### Audit reference

**RA-13.** Reference **Record** (filled circle) in transport — build lacks it.

**RA-14.** Reference **Click** (metronome) — build lacks it.

**RA-15.** Reference **Band, Lyrics, Stable** toolbar buttons — build lacks them. **[ARCHITECTURE.md](../../ARCHITECTURE.md)** defers full **band** and **lyrics**; **Stable** is product-specific — **do not implement** without HITL/TL scope decision.

**RA-16.** Reference **H/V zoom %** at top-right (± pairs). Build: no grid zoom.

**RA-20.** **Tempo/meter** affordance at **bottom** of grid in build; reference: **top** toolbar readouts.

**RA-21.** **“1:1”** label next to Rewind without functional zoom — remove or tie to **RA-16** (actual zoom reset).

### Scope

| In scope | Out of scope (defer) |
|----------|----------------------|
| **Record** + **Click** as transport toggles wired to playback engine / Tone where APIs exist | Full DAW-style recording to disk — confirm scope is **UI + transport state** only |
| **Zoom:** extend [Viewport](../../shared/types/editor.ts) or UI store with **horizontal** (and optionally **vertical**) zoom factors; ± controls in toolbar per reference position; grid/canvas use existing `pixelsPerTick` / layout pipeline | Per-track zoom / separate H/V if product says “single zoom only” — document ASSUMPTIONS |
| Move **tempo/meter** edit entry point to **top band** (may reuse [TempoMeterAtMeasureDialog](../../client/src/components/controls/TempoMeterAtMeasureDialog.tsx)); remove duplicate from [MeasureBar](../../client/src/components/MeasureBar.tsx) if redundant | Lyrics editor surface |
| Remove or repurpose **“1:1”** when zoom exists | **RA-15** full features — see gate below |

### RA-15 — Scope gate (TL / HITL)

Choose **one** before Builder brief:

- **A)** Omit buttons until post-MVP.  
- **B)** **Stub**: disabled + tooltip “Not in MVP”.  
- **C)** HITL expands scope (document in ARCHITECTURE / ROADMAP).

Default **A or B** per preconditions.

### Workstreams (order)

1. **RA-16 + RA-21** — Implement zoom state end-to-end; map “1:1” to **reset zoom** or remove label.
2. **RA-20** — Relocate tempo/meter **display + edit** to transport/toolbar cluster per UX §5.8 readout pattern.
3. **RA-13** — Record button: UI + `aria-pressed`; behavior per product (may be no-op with “not implemented” toast until recording pipeline exists — **TL must specify**).
4. **RA-14** — Metronome click: toggle **Tone** click or existing metronome path.
5. **RA-15** — Implement chosen gate (omit/stub/disabled trio).

### Primary files

- [TransportControls.tsx](../../client/src/components/controls/TransportControls.tsx)
- [playbackStore.ts](../../client/src/store/playbackStore.ts) / audio engine modules
- [uiStore.ts](../../client/src/store/uiStore.ts) or viewport slice — zoom fields
- [EditorLayout.tsx](../../client/src/app/EditorLayout.tsx), [MeasureBar.tsx](../../client/src/components/MeasureBar.tsx)
- [EditorCanvas.tsx](../../client/src/components/editor/EditorCanvas.tsx) + [layout.ts](../../client/src/engine/renderer/layout.ts) — consume zoom

### Acceptance criteria

1. User can adjust **horizontal grid zoom** with ±; canvas and hit-test stay aligned (no drift at non-1.0 zoom).
2. **Tempo/meter** accessible from **top** chrome; RA-20 satisfied per Reviewer checklist.
3. **Record** and **Click** visible; **Click** audibly toggles metronome **or** documented placeholder with ⛔ if engine gap.
4. **1:1** either removed or equals **reset zoom** once RA-16 lands.
5. **RA-15** resolved per gate — no accidental implied full band/lyrics.

### Interfaces

- If `TransportControlsProps` or `Viewport` gains fields — **TL updates [INTERFACES.md](../../INTERFACES.md)** before merge.

### QA package

- Component tests for zoom changing viewport scale factor.
- E2E: zoom → note position stable; transport buttons present.
- **PAT-030** if parallel agents run E2E.

### Briefing note

- List **RA-13,14,16,20,21** + RA-15 gate letter; avoid scope creep into recording backend.

---

## Wave 9 — Minor cleanup (RA-17, RA-19)

### Audit reference

**RA-17.** Left panel **“Applied chords”** + **ROMAN** subheader with **no data** — placeholder waste.

**RA-19.** Label **“Chord palette / C major - diatonic”** vs reference **“Chords in C major”**; missing **Reset** inline with header.

### Scope

| In scope | Out of scope |
|----------|----------------|
| **Remove** empty “Applied chords” block **or** populate with real summary (Roman list / last applied) — product pick one | Large new “applied chord history” feature without brief |
| Align **section title** + add **Reset** (clear palette selection / key context per INTERFACES) | Rewriting entire palette copy deck |

### Workstreams

1. **RA-17** — Delete dead section **or** implement minimal **read-only** summary tied to selection/song (single PR scope).
2. **RA-19** — Copy + **Reset** button behavior (confirm with theory: reset degrees vs key only).

### Primary files

- [ChordPalette.tsx](../../client/src/components/panels/ChordPalette.tsx), [EditorLayout.tsx](../../client/src/app/EditorLayout.tsx)

### Acceptance criteria

1. No large **empty** placeholder blocks in left panel **or** populated with meaningful content.
2. Heading matches reference **intent** (“Chords in &lt;key&gt;” pattern) + **Reset** works and is tested.

### QA package

- RTL: Reset triggers expected store action once.

### Briefing note

- **RA-17, RA-19** only — small PR, fast Reviewer.

---

## Cross-wave matrix

| Wave | Audit / gate | Main risk | Notes |
|------|----------------|-----------|--------|
| 7 | RA-10, RA-12 | Touch targets vs density | Designer on conflicts |
| 8 | RA-13–16, 20–21, RA-15 gate | Recording scope creep | TL pins Record behavior |
| 9 | RA-17, RA-19 | Product ambiguity on “Applied chords” | TL picks remove vs populate |

**OB-6** (global UI scale): primarily **Wave 7** with Wave 6; if still insufficient, **follow-up** task — may require **UX_GUIDELINES** amendment (**Designer only**).

---

*Last updated: 2026-04-16 — planning artifact for REF_AUDIT_1 + operator backlog alignment.*
