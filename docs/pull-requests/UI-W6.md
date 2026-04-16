# [UI-W6] Shell consolidation — single transport row, loop inline, MIDI cluster, MVP stubs

**Base branch:** `develop`  
**Feature branch:** `phase-8/ui-shell-consolidation`

---

### What was built

This PR delivers REF_AUDIT_1 **RA-9**, **RA-11**, **RA-18**, and **RA-15** (task **UI-W6**). **RA-9 / RA-11:** The standalone full-width `LoopBar` row is removed; loop start/end, Set loop, and Clear loop live inside `data-testid="vybpad-transport-toolbar"` via a new optional `loopContent` slot. **RA-18:** The trailing MIDI export region uses `data-testid="vybpad-midi-export-cluster"` with `role="group"` and `aria-label="MIDI export"`, wrapping format + download + drag (UX §5.8). **RA-15:** Disabled stub buttons **Band**, **Lyrics**, and **Stable** with `title` and `aria-describedby` explaining MVP deferral. **TASK-8.4** visual baselines (`editor-empty`, `editor-populated`) updated for the shorter page (one fewer chrome band).

---

### ASSUMPTIONS

- **INTERFACES.md** lists `TransportControlsProps` without `loopContent`; the implementation adds an optional prop for shell composition only (EditorLayout passes `<LoopBar />`). TL may mirror this in INTERFACES in the same merge window.
- **Stub placement** in the transport row (after tempo / loop, before trailing MIDI) matches “reference parity” without implying future panel wiring.

---

### Deviations from task brief

None.

---

### Blocking flags

#### INTERFACES.md change required?

⛔ **BLOCKING (doc sync):** Add optional `loopContent?: React.ReactNode` to `INTERFACES.md` § `TransportControls` / `TransportControlsProps` so the RA-11 composition matches the canonical contract. Runtime behavior is complete; merge should not drop the doc update.

#### UX_GUIDELINES.md change required?

No UX guideline gaps. Implementation follows §5.8 (MIDI cluster anatomy, single grouped region) and §7 (prefer single transport row).

---

### SELF-REVIEW CHECKLIST

```
SELF-REVIEW CHECKLIST
─────────────────────────────────────────────────────
Matches ARCHITECTURE.md patterns          [ ✔ ]
  Notes: React + Tailwind (PAT-008); no new stores; loop still uses PlaybackStore from LoopBar.

Respects INTERFACES.md                    [ ✔ ]
  Notes: TransportControls props aligned except new optional `loopContent` pending INTERFACES mirror (flagged above). `endContent` unchanged.

Respects UX_GUIDELINES.md (if UI task)   [ ✔ ]
  Notes: §5.8 trailing MIDI cluster; §7 single toolbar band where possible.

Error handling present                    [ ✔ ]
  Notes: No change to playback init/error paths; stubs are inert.

Edge cases considered                     [ ✔ ]
  Notes: `loopContent` optional for isolated tests; MIDI cluster only when `endContent` set; document order keeps tempo before cluster for RA-18.
─────────────────────────────────────────────────────
```

**Patterns applied:** PAT-008 (component structure; Tailwind only).

---

### Pre-flight (raise-pr)

- [x] Code compiles with no errors (`npm run build`)
- [x] Lint passes (`npm run lint`)
- [x] QA pre-written tests pass (`npm test`; `npx playwright test client/tests/e2e/ui-shell-consolidation.ui-w6.spec.ts`)
- [x] `scripts/ci-local.sh` passes (requires Postgres `vybpad_ci` + env per script)
- [x] On branch `phase-8/ui-shell-consolidation`
- [x] Scope limited to shell/MIDI/loop/stubs + TASK-8.4 snapshots + this PR doc

---

### Visual baselines

`client/tests/e2e/editor-shell.task-8-4.visual.spec.ts-snapshots/editor-empty-visual-linux.png` and `editor-populated-visual-linux.png` regenerated (one fewer horizontal chrome band).
