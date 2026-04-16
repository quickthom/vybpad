# [UI-W5] Multi-voice playback parity + chord library discovery tabs

**Base branch:** `develop`  
**Feature branch:** `phase-8/ui-voices-discovery`

---

### What was built

This PR delivers REF_AUDIT_1 **RA-7** and **RA-8** (task **UI-W5**). **RA-7:** `buildScheduledPlayEvents` accepts an optional third argument `{ melodyVoiceVisible }` (defaults to all lanes on) so hidden editor melody lanes do not produce scheduled `melody2`–`melody4` events; the Tone playback path syncs visibility from `useUIStore` before `loadSong`. The toolbar **Voice {activeVoice+1}** label remains driven only by `uiStore.activeVoice`. Piano keyboard highlights use the same visibility when deriving `scheduledPlayEvents`. **RA-8:** `ChordPalette` implements `libraryTab` + `onLibraryTabChange` with a `role="tablist"` / **aria-label** “Chord library”, tabs **Magic, Popular, Search, Progressions, Bass Sets**, Progressions presets A/B with distinct degree fingerprints, and minimal interactive content on other tabs per QA `data-testid`s. `EditorLayout` owns library tab state and passes it into the palette; TASK-8.4 visual baselines updated for the taller left rail.

---

### ASSUMPTIONS

- **MIDI export / other callers** of `buildScheduledPlayEvents` without options continue to schedule all melody lanes (export remains full score unless a future task narrows it).
- **Playback engine visibility** is synced from `UIStore` whenever the song or `melodyVoiceVisible` changes (same cadence as existing `syncPlaybackEngineWithSong`).

---

### Deviations from task brief

None.

---

### Blocking flags

#### INTERFACES.md change required?

No interface changes required. `ChordPaletteProps` for `libraryTab` / `onLibraryTabChange` and optional scheduler options are already documented in INTERFACES (ChordPalette + inline JSDoc on `BuildScheduledPlayEventsOptions`). `AudioEngine.loadSong` signature unchanged; scheduling visibility uses `setPlaybackMelodyVoiceVisibleForScheduling` before `loadSong`.

#### UX_GUIDELINES.md change required?

No UX guideline gaps.

---

### SELF-REVIEW CHECKLIST

```
SELF-REVIEW CHECKLIST
─────────────────────────────────────────────────────
Matches ARCHITECTURE.md patterns          [ ✔ ]
  Notes: Zustand + playback engine; Tone scheduling; client-only UI state.

Respects INTERFACES.md                    [ ✔ ]
  Notes: `ChordPaletteProps` library tab API; `UIStore.melodyVoiceVisible`; optional `buildScheduledPlayEvents` options documented in scheduler JSDoc (INTERFACES-aligned behavior).

Respects UX_GUIDELINES.md (if UI task)   [ ✔ ]
  Notes: §7 chord palette rail; tablist accessible name; 288px panel unchanged.

Error handling present                    [ ✔ ]
  Notes: No new user-facing error paths; progression/chord emits use existing theory helpers.

Edge cases considered                     [ ✔ ]
  Notes: Controlled vs uncontrolled `libraryTab`; mixer mute still applied at `playScheduledEvent`; visibility reset on engine dispose.
─────────────────────────────────────────────────────
```

**Patterns applied:** PAT-001 (error shapes unchanged), PAT-008 (one component per file / ChordPalette), PAT-012 (layout tokens preserved).

---

### Visual baselines

Designer/TL note: `editor-empty-visual-linux.png` and `editor-populated-visual-linux.png` regenerated for chord library tab row (TASK-8.4).
