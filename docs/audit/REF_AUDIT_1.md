## UI Audit: Actual State vs. Reference

---

### 🔴 Severity 5 — Breaks the App

---

**RA-1. The main grid is not a piano roll — it has no pitch axis and no note rows.**
The reference uses a full piano roll as the central editing surface. The Y-axis labels pitch rows by note name and octave (e.g., "7B, A, G, F, E, D, C" going top to bottom), and notes are entered as horizontal colored rectangles that span their duration across the grid. In the actual implementation, the grid has no Y-axis of any kind. There are no pitch rows. The grid appears to be a flat, single-row-per-measure layout where chord blocks appear as small colored squares sitting in a single horizontal band. The entire fundamental data model of the editor is not being expressed visually.

**RA-2. The chord track at the bottom of the piano roll grid is entirely absent.**
In both reference screenshots, a dedicated chord track runs along the very bottom edge of the main grid area. It displays large roman numeral chord labels (e.g., I, V⁷, vi, IV) with the chord root names below them (e.g., C, G, am, F). This track is visually distinct from the note-editing area and serves as a persistent, readable summary of the harmonic structure. In the actual build, this chord track does not exist at all — the bottom of the grid shows only a row of measure numbers followed by Tempo/meter, Add, and Delete buttons.

**RA-3. Notes in the grid are not rendered as horizontal duration bars.**
In the reference, all entered notes appear as horizontal colored rectangles whose left edge is the note's start position and whose width represents the note's duration. Multiple notes can stack vertically within a measure. In the actual build, what appear to be chord entries are rendered as small uniform-sized colored square tiles with a number on them, all sitting on the same horizontal line near the top of the grid. This means duration, pitch, and polyphony are not visually communicated at all.

---

### 🟠 Severity 4 — Interferes with Regular Use

---

**RA-4. The entire right-side properties panel is missing.**
Both reference screenshots show a right panel. In the melody view, it contains: Active Melody Voice selector (buttons 1–4), Visible Melody Voices checkboxes, Display of Inactive Voices options (Outline / Solid / Alpha toggle), and a Smart Octave toggle. In the chord view, it contains: Chord Properties with Type selector (Triad, 7, 9, 11, 13), Inversion selector (None, 1st, 2nd), Options checkboxes (sus2, sus4, add9, add11, add13, no3, no5), Secondary selector (None, V/, IV/, vi/), and Borrow From selector. None of this exists in the actual build. Users have no way to control voice visibility, modify chord voicing, set inversions, or add extensions.

**RA-5. Duration controls are missing from the left panel.**
In the reference chord view, the left panel opens with a Duration field (currently showing "Duration: 4") and in the melody view there is a vertical duration selector showing 1/4, 1/2, 1, 2, ADD with Split and Tie buttons below. These controls determine how long a placed note or chord will be. The actual build has no duration controls whatsoever. Users cannot set note duration before placing, which makes precise entry impossible.

**RA-6. Individual note entry buttons are missing from the left panel.**
In the reference melody view, the left panel includes a row of clickable note buttons labeled C, D, E, F, G, A, B, and rest, under a "Notes in C major" header with a Chromatic toggle. These are the primary means of adding individual pitched notes to the piano roll. Additionally, there are Raise Half, Raise, Raise Octave, Lower Half, Lower, and Lower Octave action buttons. None of these exist in the actual build. The note-entry interface is completely absent.

**RA-7. Multi-voice track management is absent.**
The reference supports at least 4 simultaneous melody voices (labeled 1–4 in the Active Melody Voice selector on the right panel), and each has individual visibility controls. The actual build appears to have only a single "Voice 1" label in the top navigation with no mechanism to add, select, or manage other voices, and no per-voice visibility toggles.

**RA-8. Chord discovery tabs (Magic, Popular, Search, Progressions, Bass Sets) are missing.**
In the reference chord view, the left panel contains a tab bar with at minimum five tabs: Magic, Popular, Search, Progressions, and Bass Sets. The Progressions tab is shown active and opens an inline panel with common preset progressions displayed as clickable button sequences (e.g., I–V–vi–IV, I–vi–IV–V). The actual build has only a Diatonic/Borrowed two-tab switch, with no chord discovery or preset progression functionality exposed.

---

### 🟡 Severity 3 — Pervasive and Distracting

---

**RA-9. The top toolbar structure is completely wrong.**
The reference has a single compact toolbar row with the following elements in order: Play (orange circle button), Record (filled circle), Loop, Click (metronome), Mixer, Preview (eye), then Meter display (e.g., "4 Beats"), Key display (e.g., "C Min"), Tempo display (e.g., "120 BPM"), Band, Lyrics, Stable, Piano, and finally zoom percentage controls at the far right (e.g., "161%" and "92%"). The actual build has a completely different layout: the title and Save button appear in a top banner, followed by a row of tab-like nav items (Projects, ENTRY/Table toggle, Voice 1, Chords, Mixer, Settings, Piano, Key/scale, Log out), and then a separate dedicated transport row (Play, Stop, Rewind, 1:1, Tempo, BPM, Format dropdown, Download .mid, MIDI). This is three rows where the reference uses one, and the items are different. It reads as a different application entirely.

**RA-10. The chord palette buttons are styled completely differently from the reference.**
In the reference, the chord buttons in the left panel are compact, text-only rows in a single-column layout, showing the roman numeral (I, ii, iii, IV, V, vi, vii°) on the left and the root note name on the right (C, dm, em, F, G, am, b°). They are small and information-dense. In the actual build, the chord palette uses large, brightly colored rectangular tiles arranged in a two-column grid, each showing the scale degree number prominently in large text with the chord symbol below. This is visually loud and does not match the reference's design language.

**RA-11. A separate Loop controls row exists in the actual build but not the reference.**
The actual build has an entire third row dedicated to loop controls: Loop toggle, Start (ticks) input, End (ticks) input, Set loop button, Clear loop button. In the reference, Loop is just a single button in the main toolbar. The extra row takes up vertical space, pushes the grid down, and is not consistent with the reference layout.

**RA-12. "Cycle secondary (d)" and "Clear to diatonic" are exposed as prominent left-panel buttons.**
These two functions — cycling secondary chord slots and clearing borrowed chords back to diatonic — are front and center as large buttons at the bottom of the left panel in the actual build. In the reference, equivalent functionality (Secondary chord assignment, Borrow From) is tucked into the Chord Properties right panel as compact selectors. Surfacing these as major UI elements changes the perceived hierarchy and clutters the left panel.

---

### 🟢 Severity 2 — Pervasive but Harmless

---

**RA-13. Record button is missing from the transport.**
The reference transport includes a Record button (solid filled circle, distinct from Play). The actual build has Play, Stop, and Rewind but no Record.

**RA-14. Click (metronome) button is absent.**
The reference toolbar includes a Click button (metronome icon). Not present in the actual build.

**RA-15. Band, Lyrics, and Stable buttons are absent from the toolbar.**
The reference toolbar includes Band, Lyrics, and Stable as distinct interactive controls. None of these appear in the actual build.

**RA-16. Zoom/scale controls are absent.**
The reference shows zoom percentage controls at the top right of the interface (e.g., 161% horizontal zoom, 92% vertical zoom) as + and − button pairs. The actual build has no zoom controls for the grid.

**RA-17. The "Applied chords" section label and the ROMAN subheader serve no visible purpose.**
In the actual left panel, there is an "Applied chords" section with explanatory body text and a "ROMAN" subheader, but no chord data is shown below it. This area appears to be an incomplete or placeholder section. It takes up significant vertical space in the left panel without conveying useful information.

**RA-18. The Format dropdown and "Download .mid" / "MIDI" buttons are in the wrong place.**
In the reference, export-type controls are not visible in the main toolbar at all — they presumably live in a menu or separate dialog. In the actual build, Format (Full song Type 1), Download .mid, and MIDI are sitting inline in the transport bar, making the transport row visually busy and mixing playback controls with export controls.

---

### ⚪ Severity 1 — Edge Cases / Minor

---

**RA-19. Minor label discrepancy: "Chord palette" vs. "Chords in C major."**
The actual build labels the left panel section "Chord palette / C major - diatonic." The reference labels this area simply "Chords in C major" with a Reset button inline. The Reset button is also absent from the actual build.

**RA-20. The Tempo/meter button is positioned at the bottom of the grid instead of the top toolbar.**
In the actual build, there is a Tempo / meter button sitting at the bottom navigation row below the grid. In the reference, tempo and meter are displayed as live readouts directly in the top toolbar and are presumably editable from there. Placing it at the bottom is inconsistent with reference positioning.

**RA-21. "1:1" zoom label in the transport serves no clear purpose without a functional zoom control.**
The actual build shows a "1:1" label in the transport bar next to Rewind. In the reference, zoom is handled by the ± percentage controls at the top right. Without those controls, the "1:1" label is a dangling reference.