# vYbpad: Reference Audit (Iteration 2)

## NEW OPERATOR BACKLOG ITEMS

**OB-7:** Can't drag/resize notes or chords outside of their current measure.

**OB-8:** Clicking on the grid does not reposition the cursor.

**OB-9:** Dragging notes does not give any visual indication that you're dragging (they should move as you're dragging, not on mouse button up)

**OB-10:** There's no undo/redo function anywhere that I could find.

**OB-11:** The "Search" button in the Chords panel does nothing. 

**OB-12:** The "Popular" button in the Chords panel only ever has one chord in it. Research may be required to know what this is supposed to do and how it works.

**OB-13:** Clicking a chord or note should insert it at the cursor. Right now the point of insertion is unpredictable.

**OB-14:** Piano roll should show only the range of melody notes used in each line, with a minimum of one octave.

**OB-15:** More than one line of the song should render on the screen, if it will fit. 

**OB-16:** The page should not continue below the grid. If the side panels are too long to fit, have them scroll (not the whole page)


---

## UI AUDIT: SEVERITY 5 — Breaks the App

---

**RA-201. Chord track blocks are fundamentally wrong in every visual dimension**

In the reference, the chord track sits at the bottom of the piano roll and is approximately 4–5 times the height of a single melody note row — it is a large, prominent band. Each chord block fills the full height of this band. The block's interior is mostly transparent (white/light background shows through), but there is a solid, bold color strip along the very top edge and the very bottom edge of the block; this color corresponds to the color assigned to the tonic note of that chord in the global note-color system (e.g., C is red, G is teal, A is blue). The Roman numeral name of the chord (e.g., "I", "V", "vi", "IV", "Vsus4") is rendered in very large, bold text centered both horizontally and vertically inside the block — it is the largest text element in the entire UI. Below the chord track band (outside and beneath each block), the chord name in conventional notation (e.g., "C", "Gsus4", "am", "F", "G7") is rendered in smaller regular text.

In the actual state, the chord track appears to be roughly the same height as 1–2 melody rows — far too short. The blocks are entirely filled with opaque solid color (no transparency, no top/bottom color strip structure). The labels inside the blocks are small regular Arabic numerals (1, 2, 5, 7, etc.) rather than large Roman numerals. There is no conventional chord name rendered below the track. This makes the chord track visually unreadable as a chord chart and functionally useless as a compositional reference.

---

## UI AUDIT: SEVERITY 4 — Interferes with Regular Use

---

**RA-202. Chord properties panel uses dropdowns instead of the reference's button/toggle interface**

In the reference, the Chord Properties panel (accessible when a chord is selected) shows:
- **Type**: A horizontal row of pill/button options — "Triad", "7", "9", "11", "13" — where the active one is highlighted. These are compact inline toggle buttons, not a dropdown.
- **Inversion**: A row of small buttons — "None", "1st", "2nd" — styled as a button group.
- **Options**: A grid of small checkboxes with labels including sus2, sus4, add9, add#5, add11, #9, add13, b9, no3, no5, #11 — each independently toggleable, displayed in two columns of compact checkbox+label pairs.
- **Secondary**: A dropdown (this one IS a dropdown in the reference) with options like V/, V/V, V/V/, vii°/.
- **Borrow From**: A small dropdown or stepper (labeled "N/A" by default).

In the actual state, nearly every one of these is implemented as a full-width dropdown menu: Quality, Seventh, Suspension, Addition, and Borrowed mode are all dropdowns. Inversion is a plain number field. The dense, scannable button-group and checkbox interface of the reference has been replaced with sequential dropdowns that require multiple clicks and obscure available options. The chord modification workflow is significantly slower and harder to use.

---

**RA-203. Note name buttons in the melody input section are unstyled plain text, not colored labeled boxes**

In the reference, the note entry area (below the duration selector) shows note names as a horizontal row of colored rectangular buttons: each note has a distinct background color corresponding to the global note-color scheme (C = red/coral, D = orange, E = yellow, F = green, G = teal/cyan, A = blue/indigo, B = violet/purple). The note letter is shown in white or dark text inside each colored box. These are immediately visually identifiable by color and allow fast, color-associated note input.

In the actual state, the notes are displayed as plain gray/white text buttons arranged in a small grid (two rows: D E F# G / A B C#). There is no color coding, no distinct visual identity per note. The note-color system that the rest of the UI depends on (grid row colors, chord block colors) has no visual anchor in the input palette, breaking the coherence of the color language across the app.

---

**RA-204. Raise/Lower button set is missing four of its six buttons**

In the reference, there are six buttons arranged in two rows of three:
- Top row: **"Raise Half"**, **"Raise"**, **"Raise Octave"**
- Bottom row: **"Lower Half"**, **"Lower"**, **"Lower Octave"**

These allow fine (half-step), normal (diatonic step), and coarse (octave) transposition of selected notes.

In the actual state, only two buttons exist: **"Raise"** and **"Lower"**. The half-step and octave variants are completely missing, eliminating half of the pitch-editing shortcuts and making precise transposition impossible without manual note repositioning.

---

**RA-205. Duration selector uses named fraction buttons instead of a numeric value display with visual bar indicators**

In the reference, the duration control shows a single bold numeric value (e.g., "0.5" or "4") indicating the current note duration in beats. To the left of this number, there are short horizontal bar indicators of varying lengths (labeled V/4, V/2, etc.) that give a visual, proportional representation of the note length. The user sets the duration by clicking one of these visual bar options, and the numeric value updates accordingly.

In the actual state, duration is displayed as a vertical list of labeled buttons: "1 (192 tk)", "1/2 (96 tk)", "1/4 (48 tk)", "1/8 (24 tk)", "1/16 (12 tk)" with tick counts in parentheses. This is more verbose and less visually intuitive. The tick counts are implementation details that shouldn't be exposed at this level of the UI. The visual bar metaphor of the reference — which gives an immediate spatial sense of relative note lengths — is absent.

---

**RA-206. Piano roll grid row labels include octave numbers; they should show only the note letter**

In the reference, the row labels along the left edge of the piano roll grid show only the single-character note name: C, D, E, F, G, A, B (or the equivalent scale degree number in some views like "7, B, A, G, F, E, D, C"). No octave number is shown. This keeps the label column extremely narrow and clean.

In the actual state, the row labels include full scientific pitch notation: D4, E4, F4, F#4, G4, A4, B4, C5, etc. This makes the label column wider, clutters the edge of the grid with redundant octave information, and breaks visual consistency with the reference's simpler labeling system.

---

**RA-207. Chord palette in left panel is a vertical text list instead of a horizontal row of colored Roman numeral blocks**

In the reference, the chord input palette (shown when "Chords in [Key]" mode is active) displays the available diatonic chords as a horizontal row of compact colored rectangular blocks. Each block shows the Roman numeral (I, ii, iii, IV, V, vi, vii°) in white text on a colored background, where the color matches the global tonic note color for that chord (I/C = red, ii/D = orange, iii/E = yellow, IV/F = green, V/G = teal, vi/A = blue, vii°/B = purple). Beneath each block, the chord's letter name (C, dm, em, F, G, am, b°) is shown in smaller text. This entire palette fits in one horizontal row.

In the actual state, chords are listed vertically as text entries in a scrollable list: "Imaj7 / Dmaj7", "ii7 / Em7", "iii7 / F#m7", "IVmaj7 / Gmaj7", "V7 / A7". They have no color coding, they take up much more vertical space, and they show chord extensions (maj7, etc.) inline rather than letting the user select extensions separately in the properties panel. Scanning and clicking the desired chord is much slower in this layout.

---

**RA-208. Grid rows do not have note-based background color tinting**

In the reference, each row of the piano roll grid has a very subtle background tint corresponding to its note's color in the global color system (the C row is very faintly red, the D row faintly orange, etc.). This gives the grid a gentle chromatic gradient that reinforces note identity and makes it easier to visually orient within the pitch space without reading labels.

In the actual state, all grid rows appear to have a uniform gray/white background with no note-based color differentiation. The grid looks like a generic MIDI editor rather than the color-coded system the reference design is built around.

---

## UI AUDIT: SEVERITY 3 — Pervasive and Distracting

---

**RA-209. Top navigation bar is entirely different in structure and is far more cluttered**

In the reference, the very top of the UI is a single, clean toolbar with a minimal, icon-first design. From left to right it contains: Play (orange circle button), Record (filled circle), Loop (arrows icon), Click (metronome icon), Mixer (faders icon), Preview (eye icon) — all small icon buttons with no labels. Then centered: Meter (showing "4 Beats"), Key (showing "C"), Tempo (showing "120 BPM"), Band (icon), Lyrics (icon), Stable (icon), Piano (icon). On the far right: two zoom percentage readouts ("161%" and "92%" with +/- buttons each, representing horizontal and vertical zoom independently).

In the actual state, there are two separate bars stacked:
1. A title/navigation bar with the project title "Untitled", subtitle "The First Song Ever", save timestamp, breadcrumb navigation, and a horizontal row of large navigation buttons: Projects, D/T/P Table, Voice 1, Chords, Mixer, Settings, Piano, Key/scale, Log out — along with a prominent blue "Save" button. This entire bar has no equivalent in the reference.
2. A transport bar with: Play, Stop, Rewind, "2-2", Tempo text input, BPM label, Rec, Click, a percentage field, -, +, a number field, Loop, Start (ticks) 0, End (ticks) 0, Set loop, Clear loop, Band, Lyrics, Stable, Format, Full song dropdown, Download.mid, MIDI.

The actual top section uses roughly 3–4× the vertical space of the reference, pushes the piano roll down, exposes implementation-level controls (tick counts, "2-2" display), and fragments navigation into a confusing multi-row layout.

---

**RA-210. Zoom controls show a single percentage; reference shows two independent zoom percentages**

In the reference, the top-right corner shows two separate zoom values — e.g., "161%" and "92%" — each with its own + and − buttons. These represent horizontal zoom (timeline scale) and vertical zoom (pitch row height) independently, giving the user fine control over both axes of the grid view.

In the actual state, there is a single percentage value ("100%") with one pair of +/− buttons in the transport bar, suggesting only one zoom axis is controlled. The two values in the reference are also displayed prominently in blue on the top right, making the current zoom state always visible at a glance.

---

**RA-211. Mixer is shown as an inline panel section instead of a separate overlay/modal**

In the reference, the Mixer is accessed via a dedicated "Mixer" icon button in the top toolbar. It is not visible inline in the main right panel — it is a separate control surface invoked on demand.

In the actual state, the Mixer (with Melody 1, Melody 2, Melody 3, Melody 4, and Harmony volume sliders with mute buttons) is always visible as a section at the bottom of the right panel, consuming significant vertical space and making the chord properties panel shorter. This clutters the right panel and buries the chord controls.

---

## UI AUDIT: SEVERITY 2 — Pervasive but Harmless

---

**RA-212. Progressions panel, when open, should be a floating overlay anchored to the right, not an inline panel section**

In the reference, clicking "Progressions" in the chord palette area opens a floating panel that overlays the right portion of the screen. It shows a grid/table of pre-built chord progressions, each displayed as a compact horizontal row of small colored Roman numeral blocks (e.g., I–V–vi–IV, I–IV–V–I, etc.), visually consistent with the chord block color system. The user can click a row to apply a progression. This panel has an X button to close it and is separate from the main chord properties panel.

In the actual state, the Progressions tab exists in the left panel alongside Magic/Popular/Search but the panel layout and visual style of the progressions list (if it opens) likely does not match this floating overlay format.

---

**RA-213. Left panel is proportionally wider than it should be relative to the piano roll grid**

In the reference, the left panel containing the duration selector, note palette, and chord palette is quite narrow — it occupies roughly 15–20% of the total horizontal width. The piano roll grid dominates the screen, taking up approximately 65–70% of the width, with the right panel taking the remaining 15%.

In the actual state, the left panel appears significantly wider, likely 25–30% of the screen, with the piano roll grid receiving less space as a result. This makes the composing grid feel cramped.

---

**RA-214. "ADD" button and "Split" / "Tie" buttons are absent from the note input section**

In the reference, below the note palette and duration bar, there are three small action buttons: "ADD" (which adds a rest or note of the selected duration to the end of the current voice), "Split" (which splits a selected note at the midpoint), and "Tie" (which merges two adjacent same-pitch notes into a single tied note). These appear as small inline text buttons.

In the actual state, these buttons do not appear to exist in the note input area. The Split and Tie operations may be inaccessible entirely.

---

## UI AUDIT: SEVERITY 1 — Edge Cases or Rarely Noticeable

---

**RA-215. "Diatonic" / "Borrowed" toggle buttons exist in the actual state but their visual styling doesn't match the reference**

In the reference, the toggle between diatonic and borrowed chord modes is handled through the chord properties panel under "Borrow From" (a compact dropdown). There is no dedicated toggle button pair in the left panel for this. In the actual state, "Diatonic" and "Borrowed" appear as two side-by-side toggle buttons at the bottom of the note input section, which is a different placement and a different interaction model than the reference.

---

**RA-216. Chord secondary action UI ("Cycle secondary (d)", "Clear to diatonic") exists in the actual state but is absent in the reference**

The actual state shows "Secondary actions" as a section in the right panel with two blue text links: "Cycle secondary (d)" and "Clear to diatonic". These do not appear as standalone links in the reference's chord properties panel. This may be functionality that belongs elsewhere or is redundant with the Secondary dropdown.

---

**RA-217. The "Diatonic Mode" label appears below the chord palette in the actual state with no equivalent in the reference**

A small label "Diatonic Mode" appears below the Chords reset button in the actual left panel. No such label exists in the reference. This is likely a vestigial or misplaced label from an earlier version of the interface.