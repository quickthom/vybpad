# [UI-W4] Right properties panel for melody and chord editing

**Base branch:** `develop`  
**Feature branch:** `phase-8/ui-right-properties`

---

### What was built

This PR delivers REF_AUDIT_1 RA-4 (task **UI-W4**): a dedicated **288px** right-hand **Editor properties** region that switches between **melody** controls (active voice 0–3, per-voice visibility, inactive display mode `outline` | `solid` | `alpha`, smart octave) and a **chord** inspector when a chord is selected. Chord field edits dispatch `SongStore.editChord` with `update` and `Partial<ChordEvent>`; illegal triad third inversion is blocked via a disabled `<option>` and a PAT-001 toast if an invalid apply path is hit. `EditorCanvas` honors `melodyVoiceVisible`, `inactiveMelodyDisplayMode`, and `smartOctaveEnabled` per `INTERFACES.md`; optional `data-*` attributes on the canvas mirror props for QA. Client-only persistence extends `editorUiSettingsPersistence` for the new `UIStore` fields. Acceptance criteria: melody/chord behavior, no silent illegal chord edits, `EditorLayout.ui-w4.rightProperties.test.tsx` green, `ci-local` green.

---

### ASSUMPTIONS

- **Smart octave:** New table-mode notes and text-mode degree edits choose a relative octave in `[-2, +2]` that minimizes MIDI distance to the **previous note in the same voice** (latest note before the insert beat in the same measure, else the last note in prior measures). If there is no prior note in that voice, octave stays `0`.
- **Chord vs melody panel:** While a **chord** is selected, the properties region shows chord fields only; melody-only controls return when selection is not a single chord (e.g. range/note). This keeps one focused inspector at a time.
- **Melody visibility labels:** Checkbox copy uses “Show lane N” (not “Voice N”) to avoid duplicating the toolbar “Voice N” badge text, which would break strict Playwright locators (TASK-5.9).

---

### Deviations from task brief

None.

---

### Blocking flags

#### INTERFACES.md change required?

No interface changes required.

#### UX_GUIDELINES.md change required?

No UX guideline gaps.

---

### SELF-REVIEW CHECKLIST

```
SELF-REVIEW CHECKLIST
─────────────────────────────────────────────────────
Matches ARCHITECTURE.md patterns          [ ✔ ]
  Notes: React shell + Zustand UI state; canvas renderer pipeline; client-only editor preference persistence per ARCHITECTURE.

Respects INTERFACES.md                    [ ✔ ]
  Notes: `UIStore` UI-W4 fields and setters; `EditorCanvasProps` melody props; `ChordEditAction` update path; `ChordEvent` shapes for panel controls.

Respects UX_GUIDELINES.md (if UI task)   [ ✔ ]
  Notes: §3 default 288px rail; §7 right region; §9 forms (labels / `htmlFor`, region landmark); PAT-010-aligned canvas behavior unchanged for active lanes.

Error handling present                    [ ✔ ]
  Notes: PAT-001 — `showError` on blocked inversion apply; chord seventh change merges inversion clamp when triad would otherwise be invalid.

Edge cases considered                     [ ✔ ]
  Notes: Hidden voices omitted in draw, hit-test, and playback highlight; secondary selector `V:n` / `viio:n` / `IV:n`; visual snapshots updated for layout.
─────────────────────────────────────────────────────
```

**Patterns applied:** PAT-001 (user-facing errors / toast), PAT-008 (component structure), PAT-012 (renderer layout constants).
