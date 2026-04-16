# [UI-W8] Transport zoom, metronome, record arm, key/meter band — Wave 8

**Base branch:** `develop`  
**Feature branch:** `phase-8/ui-transport-zoom`

---

### What was built

This PR delivers REF_AUDIT / remediation **UI-W8** (Wave 8): **PlaybackStore** gains `metronomeEnabled` and `recordArmed` with `setMetronomeEnabled` / `setRecordArmed` (defaults `false`) per INTERFACES. **Metronome:** Tone `MembraneSynth` + `Transport.scheduleRepeat` quarter-note click when scheduling works; if scheduling is unavailable (partial Tone mocks / constrained environments), **PAT-001** info toast on play. **Record arm:** state only; on play, info toast that disk recording is not available yet (no fake files). **TransportControls** implements optional UI-W8 props: record / metronome toggles (`vybpad-transport-record`, `vybpad-transport-metronome`), zoom readout and ± / 1:1 reset (`vybpad-zoom-*`), top band key + meter cluster and `vybpad-tempo-meter-edit` (`vybpad-transport-key-meter-cluster`). **EditorLayout** wires zoom from `useUIStore` + `viewportNavigation` helpers; **1:1** maps to zoom `1.0` (100% readout); tempo/meter edit entry moved to the transport top band (RA-20); **MeasureBar** no longer duplicates tempo/meter (measure chrome unchanged). **RA-15 gate B:** single disabled Band/Lyrics/Stable group with one `#vybpad-mvp-deferred-hint`. Outer `vybpad-transport-toolbar` carries `data-audio-ready` / `aria-busy` for E2E helpers (`helpers/transport.ts`).

---

### ASSUMPTIONS

- INTERFACES.md already lists UI-W8 `TransportControls` and `PlaybackStore` fields; implementation matches.
- Metronome audio is a minimal quarter-note click; advanced accent patterns are out of scope.

---

### Deviations from task brief

None.

---

### Blocking flags

#### INTERFACES.md change required?

No — UI-W8 fields are already in INTERFACES.md.

#### UX_GUIDELINES.md change required?

No — transport follows §5.8 (grouping, 48px bands, ghost tempo/meter entry).

---

### SELF-REVIEW CHECKLIST

```
SELF-REVIEW CHECKLIST
─────────────────────────────────────────────────────
Matches ARCHITECTURE.md patterns          [ ✔ ]
  Notes: Zustand + Tone.js; no server contract changes.

Respects INTERFACES.md                    [ ✔ ]
  Notes: TransportControls + PlaybackStore UI-W8 slice.

Respects UX_GUIDELINES.md (if UI task)   [ ✔ ]
  Notes: §5.8 transport grouping; top band for key/meter + edit.

Error handling present                    [ ✔ ]
  Notes: PAT-001 toasts for record-unavailable and metronome fallback.

Edge cases considered                     [ ✔ ]
  Notes: Metronome preference synced to engine; reset store + tests reset bridge.
─────────────────────────────────────────────────────
```

**Patterns applied:** PAT-001 (user-facing info toasts for deferred / environment limitations).

---

### Pre-flight (raise-pr)

- [x] Code compiles (`npm run build`)
- [x] Lint passes (`npm run lint`)
- [x] Unit/component tests pass (`npm test`)
- [x] `scripts/ci-local.sh` — run locally with Postgres `vybpad_ci` and env vars per script (includes E2E)
- [x] Branch `phase-8/ui-transport-zoom`
- [x] Scope: playback engine metronome hook, playback store, TransportControls, EditorLayout, PR doc

---

### E2E note

`data-audio-ready` and `aria-busy` are on the outer `data-testid="vybpad-transport-toolbar"` container (and mirrored on `role="toolbar"` for component tests) so `expectTransportPlaybackReady` in `client/tests/e2e/helpers/transport.ts` continues to resolve readiness.

**TASK-5.9 E2E:** Tempo/meter entry moved to `vybpad-tempo-meter-edit`; the spec no longer targets `vybpad-measure-tempo-meter`.

**TASK-8.4 visual baselines:** `editor-empty-visual-linux.png`, `editor-populated-visual-linux.png`, and `editor-transport-playing-visual-linux.png` regenerated for the new transport top band + controls.
