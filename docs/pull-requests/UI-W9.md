# [UI-W9] Palette heading + Reset (RA-19) + secondary inspector stub (RA-17)

## What was built

This PR implements **REF_AUDIT_1 Wave 9** items **RA-17** and **RA-19**: **`SecondaryChordInspector`** no longer renders a tall empty Roman well when no chord is selected (no `min-h-[3rem]` placeholder). The chord palette **`role="region"`** labeled **Chord palette** now uses an **`h3`** title **Chords in {key} {scale}** (e.g. **Chords in C major**) with a **Reset** control that restores **Diatonic** mode, **Magic** library tab, the default **parallel borrowed** source for the home scale (C major → natural minor / `minor`), and clears the **Search** tab filter via controlled state. **`EditorLayout`** passes **`onBrowseDefaultsReset`** to set diatonic mode and **`setChordPaletteLibraryTab('magic')`**; **`ChordPalette`** resets borrowed source and search text, and sets the internal library tab to Magic when the library strip is uncontrolled.

## ASSUMPTIONS

- **INTERFACES sync**: `onBrowseDefaultsReset` is documented on `ChordPaletteProps` in code; **INTERFACES.md** should list the same optional callback after TL review (see blocking flags).
- **Reset order**: Parent callback runs first (diatonic mode), then local reset of library tab, borrowed source, and search text — matches QA sequence expectations.

## Deviations from task brief

None.

## Blocking flags

#### INTERFACES.md change required?

> ⛔ BLOCKING: Add optional `onBrowseDefaultsReset?: () => void` to the **ChordPalette** `ChordPaletteProps` block in `INTERFACES.md` (mirrors `client/src/components/panels/ChordPalette.tsx`). Do not merge until TL resolves.

#### UX_GUIDELINES.md change required?

No UX guideline gaps.

---

## SELF-REVIEW CHECKLIST

```
SELF-REVIEW CHECKLIST
─────────────────────────────────────────────────────
Matches ARCHITECTURE.md patterns          ✔
  Notes: React + Tailwind; existing theory/palette patterns.

Respects INTERFACES.md                    ✔
  Notes: Code extends `ChordPaletteProps`; canonical doc update flagged blocking.

Respects UX_GUIDELINES.md (if UI task)   ✔
  Notes: `h3` panel title; region `aria-label` unchanged; outline (secondary) Reset button.

Error handling present                    ✔
  Notes: Optional parent callback; no throw paths added.

Edge cases considered                     ✔
  Notes: Uncontrolled library tab still resets via `setLibraryTab`; borrowed default uses `defaultBorrowedSource(homeScale)`.
─────────────────────────────────────────────────────
```

## Pattern used

- **PAT-010** — unchanged; palette rows still use `pat010DiatonicHex` where applicable.

## Pre-flight (before merge)

- [x] `tsc --build` clean  
- [x] `eslint` clean  
- [x] `npm test` (Vitest) — 946 tests  
- [ ] `./scripts/ci-local.sh` — ensure **nothing is listening on `127.0.0.1:3001` or `127.0.0.1:5173`** before the script runs (Playwright `webServer` health checks).  
- [x] Branch `phase-8/ui-palette-cleanup`  

---

### STATUS_UPDATE (after PR opened)

```
STATUS_UPDATE
Task ID: UI-W9
Status: in-review
Branch: phase-8/ui-palette-cleanup
PR: <fill on open>
Blocking flags: INTERFACES.md optional prop for `onBrowseDefaultsReset`
```
