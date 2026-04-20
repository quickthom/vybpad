# [UI-R2-W5.2] Active melody range drag mapping (OB-14 range anchor)

**Base branch:** `develop`  
**Feature branch:** `phase-ui-r2/w5-2-ob14-render-hit`

---

### What was built

This PR remediates the blocker where active melody pitch ranges could still clamp vertical pointer mapping to non-negative rows during drag/edit interactions. It removes the `Math.max(0, ...)` row-floor in `nearestPitchGridFromStaffRelY` so negative staff-relative Y values (from low/negative active pitch anchors) can resolve to negative diatonic rows.

It also adds regression coverage for the fixed path in `client/tests/unit/components/editor/pointerMath.ob-5-magnetic-snap.test.ts` to ensure negative-row snapping remains supported.

---

### ASSUMPTIONS

- `ARCHITECTURE.md`, `INTERFACES.md`, and existing OB-14 layout work already define the active-voice pitch range contract used by `EditorCanvas`.
- The `EditorCanvas` pointer flow already passes `activeVoicePitchRange` and a song-derived `melodyRowHeight` into the staff coordinate conversion path.

---

### Deviations from task brief

None.

---

### Blocking flags

#### INTERFACES.md change required?

No — no shared interface contract changes in this blocker-only pass.

#### UX_GUIDELINES.md change required?

No — this is behavioral bugfix + test only.

---

### SELF-REVIEW CHECKLIST

```
SELF-REVIEW CHECKLIST
─────────────────────────────────────────────────────
Matches ARCHITECTURE.md patterns          [ ✔ ]
  Notes: EditorCanvas geometry and note hit path remain unchanged aside from unclamped row span.

Respects INTERFACES.md                    [ ✔ ]
  Notes: `EditorCanvasProps` usage is unchanged; only math path in pointer mapping is updated.

Respects UX_GUIDELINES.md (if UI task)   [ ✔ ]
  Notes: Input and drag behavior unchanged; only edge-row accessibility corrected.

Error handling present                    [ ✔ ]
  Notes: No new throw paths; function remains finite-safe by caller invariants and existing guards.

Edge cases considered                     [ ✔ ]
  Notes: Negative `relY` now yields negative rows for active ranges with negative anchors.
─────────────────────────────────────────────────────
```

**Patterns applied:** PAT-018 (chromatic staff-row offsets), PAT-012 (canvas spacing constants).

---

### Pre-flight (raise-pr)

- [ ] Code compiles (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Targeted unit tests passed (`npm run test`)
- [ ] Scope: pointer math clamp removal + negative-row regression test + PR checklist doc
