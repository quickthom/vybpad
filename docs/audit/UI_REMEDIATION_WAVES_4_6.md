# UI remediation — Waves 4–6 (detailed breakdown)

> Companion to [REF_AUDIT_1.md](REF_AUDIT_1.md), [UI_REMEDIATION_WAVES_2_3.md](UI_REMEDIATION_WAVES_2_3.md), and the Tech Lead sequencing plan ([ui_remediation_sequencing_ec8db0c2.plan.md](../../ui_remediation_sequencing_ec8db0c2.plan.md)).  
> Canonical contracts: [ARCHITECTURE.md](../../ARCHITECTURE.md), [INTERFACES.md](../../INTERFACES.md), [UX_GUIDELINES.md](../../UX_GUIDELINES.md) §5–7, [PATTERNS.md](../../PATTERNS.md).

**Dependencies:** Wave **3** merged (RA-5, RA-6) before Wave 4. Wave **4** before Wave 5 (voice UI in right panel pairs with RA-7). Wave **5** before Wave 6 (shell refactor last among editor-feature waves to avoid thrash). Wave **2** merge is required before Wave 6 if chord strip height affects toolbar layout.

---

## Wave 4 — Right properties panel (RA-4)

### Audit reference

**RA-4.** Reference shows a **right panel** with context-specific content:

- **Melody view:** Active Melody Voice (1–4), Visible Melody Voices checkboxes, Display of Inactive Voices (Outline / Solid / Alpha), Smart Octave toggle.
- **Chord view:** Chord Properties — Type (Triad, 7, 9, 11, 13), Inversion (None, 1st, 2nd), Options (sus2, sus4, add9, …, no3, no5), Secondary (None, V/, IV/, vi/), Borrow From.

Current build: these affordances are missing (mixer/settings/piano may occupy the right rail instead).

### Scope

| In scope | Out of scope (defer) |
|----------|----------------------|
| A dedicated **properties** region on the **right** (new component or structured region) that **switches** between melody vs chord panels based on editor mode / selection | **RA-8** discovery tabs — Wave 5 |
| Wire controls to **existing** `ChordEvent` / `NoteEvent` / UI store fields where they already exist | New music-theory features not in `theoryEngine` — escalate |
| Keyboard-accessible controls per [UX_GUIDELINES.md](../../UX_GUIDELINES.md) §9 | **RA-10** palette styling — Wave 7 |

### Intended end state

1. **Discoverability:** User opens editor and finds **voice**, **inactive display**, and **smart octave** in melody mode; **type**, **inversion**, **extensions**, **secondary**, **borrow** in chord mode — without hunting in unrelated dialogs.
2. **Data binding:** Changing a control updates the **song store** (and any derived labels) consistently with [INTERFACES.md](../../INTERFACES.md) shapes.
3. **Layout:** Right column follows UX §3 width (default **288px**, min/max per §3) and §7 region list — properties may **stack with** or **replace** non-essential right content per brief; document ASSUMPTIONS if mixer is collapsed behind a tab.

### Workstreams (recommended order)

1. **INTERFACES + TL gate** — Confirm `ChordEvent`, `NoteEvent`, `UIStore` / selection types expose every field the panel needs (inversion, embellishments, `secondary`, borrowed mode, voice index, visibility flags). **TL updates INTERFACES.md before Builder starts** if props are missing.
2. **Panel shell** — Add `EditorPropertiesPanel` (or equivalent) under [client/src/components/panels/](../../client/src/components/panels/), mounted from [EditorLayout.tsx](../../client/src/app/EditorLayout.tsx) in the right rail.
3. **Melody section** — Active voice `0|1|2|3` (already in INTERFACES patterns), visible voices, inactive rendering mode, smart octave — connect to [uiStore](../../client/src/store/uiStore.ts) / song mutations as defined in INTERFACES.
4. **Chord section** — Type, inversion, checkboxes, secondary dropdown, borrow-from — map to existing chord edit actions (same pipeline as keyboard/increment shortcuts where possible).
5. **Mode switching** — When user toggles ENTRY/table, chord vs melody, or selection type, panel shows the correct section (clear rules in brief to avoid ambiguous empty states).

### Primary files (expect edits)

- [EditorLayout.tsx](../../client/src/app/EditorLayout.tsx) — right column composition, panel visibility.
- New: `EditorPropertiesPanel.tsx` or split `MelodyProperties.tsx` / `ChordProperties.tsx` under `components/panels/`.
- [uiStore](../../client/src/store/uiStore.ts) / [song store](../../client/src/store/) — only if INTERFACES-approved fields are missing.
- [INTERFACES.md](../../INTERFACES.md) — **TL only** if contracts change.

### Acceptance criteria (Reviewer-ready)

1. In **melody** context, user can select **active voice 1–4** and toggle **per-voice visibility**; inactive voices render per selected mode (outline/solid/alpha) on canvas.
2. In **chord** context, user can change **quality type**, **inversion**, listed **embellishments**, **secondary**, and **borrow** on the **selected chord** (or armed chord per product rules — document in ASSUMPTIONS).
3. Panel state reflects **current selection**; invalid operations show no silent failure (toast or disabled control per PAT-001).
4. `ci-local` passes; component tests cover at least one melody and one chord mutation through the panel.

### QA package

- RTL/component tests for panel sections + store updates.
- E2E optional: select chord → change inversion → export or visual check.

### Escalation

- **Designer** if reference control grouping conflicts with **UX_GUIDELINES.md** §5 form patterns.
- **TL** if INTERFACES changes ripple to server/shared types.

### Briefing note

- Task IDs **RA-4**; quote INTERFACES sections for `ChordEvent`, `UIStore`, and panel props verbatim in the brief.

---

## Wave 5 — Multi-voice + chord discovery (RA-7, RA-8)

### Audit reference

**RA-7.** At least **four melody voices**, active voice selector (ties to Wave 4), **per-voice visibility** — reference places selector on right panel; build only shows “Voice 1” in nav without full management.

**RA-8.** Left chord area should expose tabs: **Magic, Popular, Search, Progressions, Bass Sets**; Progressions shows preset sequences (e.g. I–V–vi–IV) as clickable buttons. Build only has Diatonic/Borrowed.

### Scope

| In scope | Out of scope (defer) |
|----------|----------------------|
| **RA-7:** Ensure **four voices** are selectable, schedulable, and **visibly** distinct per Wave 4 visibility rules; top nav or panel must not contradict right panel | “Aria” / AI — never |
| **RA-8:** Tab bar + **minimum viable** content per tab (can be phased: e.g. **Progressions** first with preset buttons backed by static data + theory) | Full search index / external libraries without TL approval |
| Reuse [theoryEngine](../../client/src/engine/theory/) for Roman/progression spelling | Server-side chord discovery APIs |

### Intended end state

1. **RA-7:** Playback and canvas show **multiple melody voices** according to visibility; switching active voice affects **entry target** consistently with shortcuts (Ctrl+1–4 per ROADMAP Phase 5).
2. **RA-8:** User opens chord side panel, sees **five tabs**, can apply at least **one** progression preset that inserts or suggests chords per brief (exact behavior must match ASSUMPTIONS).

### Workstreams — RA-7

1. Audit **scheduler + canvas** for `NoteEvent` voice index — ensure all four voices render and play.
2. Align **top bar** “Voice 1” with Wave 4 **Active Melody Voice** (single source of truth in `uiStore`).
3. Remove redundant or misleading nav labels if right panel is canonical.

### Workstreams — RA-8

1. **Tab chrome** — Extend [ChordPalette](../../client/src/components/panels/ChordPalette.tsx) or parent with secondary tab row (Magic, Popular, …) without breaking diatonic/borrowed **theory** mode (may nest: primary = theory source, secondary = discovery — document).
2. **Progressions** — Data: curated list of degree sequences; action: apply to selection or next measures via existing chord mutation helpers.
3. **Magic / Popular / Search / Bass Sets** — Minimum: placeholder with “coming soon” is **not** acceptable if brief requires parity; ship **functional** stubs (e.g. Popular = sorted by frequency from static table, Search = filter diatonic chords by text) per TL-approved scope.

### Primary files

- [EditorLayout.tsx](../../client/src/app/EditorLayout.tsx), [ChordPalette.tsx](../../client/src/components/panels/ChordPalette.tsx).
- [Playback / scheduler](../../client/src/engine/audio/) — if voice routing is incomplete.
- [EditorCanvas](../../client/src/components/editor/EditorCanvas.tsx) — multi-voice note rendering (may already exist post Wave 1).

### Acceptance criteria

1. **RA-7:** Project with notes on **voice 0 and 1** plays both; muting/hiding voice works from panel controls.
2. **RA-8:** All five tabs **visible**; Progressions applies at least two distinct presets without console errors.
3. No regression to Waves 1–4 acceptance paths.

### QA package

- Unit tests for progression application (pure function if extracted).
- E2E: switch voice → add note → verify voice in exported MIDI or store snapshot per project capability.

### Split option (large wave)

| Sub-wave | Content |
|----------|---------|
| 5a | RA-7 only — merge before 5b |
| 5b | RA-8 tabs + Progressions + incremental tab fill |

Use when Reviewer context or CI time exceeds comfort threshold.

### Briefing note

- **RA-7 + RA-8** in one brief **or** two sequential briefs (5a/5b); cite audit IDs separately.

---

## Wave 6 — Shell consolidation (RA-9, RA-11, RA-18)

### Audit reference

**RA-9.** Reference: **one** compact toolbar row (Play, Record, Loop, Click, Mixer, Preview, meter, key, tempo, Band, Lyrics, Stable, Piano, zoom %). Build: **three** rows (banner + nav tabs + transport) — different app silhouette.

**RA-11.** Build has a **dedicated loop row** (Loop, Start/End ticks, Set, Clear). Reference: **Loop** is a single control in the main toolbar.

**RA-18.** **Format**, **Download .mid**, **MIDI** inline in transport makes the bar busy; reference keeps export **out** of the primary transport row (menu/dialog).

### Scope

| In scope | Out of scope (defer) |
|----------|----------------------|
| Restructure [EditorLayout](../../client/src/app/EditorLayout.tsx) + [TransportControls](../../client/src/components/controls/TransportControls.tsx) toward **reference order** where it does not conflict with **UX_GUIDELINES.md** §5.8 (MIDI cluster anatomy) | **RA-13–16, RA-20–21** (Record, Click, zoom %, tempo position) — **Wave 8** |
| **RA-11:** Fold loop into **toolbar/transport** — integrate [LoopBar](../../client/src/components/controls/LoopBar.tsx) or its controls into a single band; remove extra vertical row | **RA-15** Band/Lyrics/Stable — **product scope** (ARCHITECTURE: band/lyrics often deferred); stub vs omit requires **HITL/TL** decision |
| **RA-18:** Move MIDI export cluster to **menu, overflow, or trailing group** per UX §5.8 **without** violating accessibility (group label, hit targets) | Pixel-perfect match to Hookpad if Designer says UX doc wins |

### Intended end state

1. **Vertical space:** Editor gains **one fewer full-width row** vs current (loop row absorbed).
2. **Information architecture:** Primary **playback + meter/key/tempo** readouts live in **one** top band; Save/title/nav either second row **or** folded per **Designer-approved** wireframe if reference conflicts with UX §7.
3. **Export:** Format + download + drag MIDI are **grouped** and not interleaved with Play/Stop in a way that fails §5.8; labels and `aria-label`s preserved.

### Workstreams (order inside wave)

1. **RA-9 — Structure** — Prototype region order: toolbar (transport + key/meter/tempo + tools) → editor → measure bar. Use [UX_GUIDELINES.md](../../UX_GUIDELINES.md) §7 regions as authority; reference screenshot as secondary.
2. **RA-11 — Loop** — Replace `LoopBar` full-row with compact controls inside `TransportControls` or a single **48px** strip; preserve loop behavior (store/API unchanged).
3. **RA-18 — Export** — Move [MidiExportControls](../../client/src/components/controls/MidiExportControls.tsx) / [MidiDragExportControl](../../client/src/components/controls/MidiDragExportControl.tsx) to overflow menu, `endContent` group, or dedicated **Export** dropdown per §5.8.

### Primary files

- [EditorLayout.tsx](../../client/src/app/EditorLayout.tsx) — dominant diff.
- [TransportControls.tsx](../../client/src/components/controls/TransportControls.tsx), [LoopBar.tsx](../../client/src/components/controls/LoopBar.tsx).
- [MidiExportControls.tsx](../../client/src/components/controls/MidiExportControls.tsx), possibly [App](../../client/src/app/) shell routes.

### Acceptance criteria

1. **RA-9:** Visual snapshot or checklist: **fewer** horizontal chrome bands than pre-change baseline; Play and core readouts reachable without scrolling the page chrome.
2. **RA-11:** No standalone full-width **loop-only** row; loop still functional (set region, play loops).
3. **RA-18:** MIDI export controls remain **keyboard-focusable** and grouped; §5.8 Reviewer checklist passes.
4. Full `ci-local`; E2E workflow tests updated for moved selectors.

### QA package

- Update Playwright selectors in [client/tests/e2e/](../../client/tests/e2e/) for new DOM hierarchy.
- Optional visual regression if project uses screenshots for editor shell.

### Designer / TL touchpoints

- **Designer:** RA-9 vs UX §7 single-row preference — **escalate** if reference demands three rows but UX demands 48px single toolbar.
- **TL:** If moving Save/Logout affects **auth** routes or **INTERFACES** for `TransportControlsProps`, update INTERFACES first.

### Product scope (RA-9 items Band, Lyrics, Stable)

[ARCHITECTURE.md](../../ARCHITECTURE.md) defers full **band** and **lyrics**; for reference parity the brief must state one of:

- **Omit** buttons until scope expands, or  
- **Stub** (disabled + tooltip “Not in MVP”), or  
- **HITL** approves MVP scope expansion.

Do not let Builder decide alone.

### Briefing note

- **RA-9, RA-11, RA-18** in one brief; include ASCII or linked wireframe to reduce layout churn.

---

## Cross-wave matrix

| Wave | Audit IDs | Main risk | Typical branch slug |
|------|-----------|-----------|---------------------|
| 4 | RA-4 | INTERFACES churn | `phase-8/ui-right-properties` |
| 5 | RA-7, RA-8 | Feature bloat / tab scope | `phase-8/ui-voices-discovery` |
| 6 | RA-9, RA-11, RA-18 | E2E selector breakage | `phase-8/ui-shell-consolidation` |

**Parallelism:** Default **sequential** 4 → 5 → 6. Parallel 4 + 5 only if Wave 5 is **RA-7-only** (5a) in a separate worktree and **proven** no `EditorLayout` overlap — usually false; TL should assume **one Builder** through these waves.

---

*Last updated: 2026-04-16 — planning artifact for REF_AUDIT_1 remediation.*
