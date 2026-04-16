# [UI-W7] Palette density (RA-10) + secondary controls in properties (RA-12)

## What was built

This PR implements **REF_AUDIT_1 RA-10** and **RA-12**: diatonic and borrowed Magic-tab rows use a single-column, dense layout (Roman numeral + absolute chord name) with **PAT-010** hues via `pat010DiatonicHex`; **Cycle secondary** / **Clear to diatonic** move from the left rail into **ChordProperties** (compact tertiary-style buttons with `data-testid` hooks), using the same `cycleSecondaryChordEdit` / `clearSecondaryChordEdit` paths as before. **TASK-8.4** visual baselines and **TASK-5.9** / **TASK-7.5** E2E selectors were updated for the relocated inspector and Roman readout (`properties-chord-roman`).

## ASSUMPTIONS

- **Roman + chord name in properties**: Exposing `properties-chord-roman` plus a key/scale line in the right inspector is the intended replacement for the old left-rail Roman `aria-live` region for selection/Playwright observability.
- **E2E helper**: `clickFirstChordStrip` is shared in `helpers/chordStripInteraction.ts` to avoid duplicating PAT-012 hit math across specs.

## Deviations from task brief

- **Files touched beyond the listed trio**: `EditorPropertiesPanel.tsx` (required to pass key/scale + secondary callbacks into `ChordProperties`), E2E helpers/specs, and **TASK-8.4** PNG snapshots after intentional palette layout change.
- **`SecondaryChordInspector`** remains defined and exported from `ChordPalette.tsx` for the existing component sweep test; it is no longer mounted in `EditorLayout`.

## Blocking flags

#### INTERFACES.md change required?

No interface changes required. `ChordProperties` props are internal to the client panel layer.

#### UX_GUIDELINES.md change required?

No UX guideline gaps. Spacing uses the 4px grid; chord swatches follow **PAT-010**; secondary actions use tertiary/ghost styling (§1 semantic buttons).

---

## SELF-REVIEW CHECKLIST

```
SELF-REVIEW CHECKLIST
─────────────────────────────────────────────────────
Matches ARCHITECTURE.md patterns          ✔
  Notes: React + Tailwind; theory via existing `theoryEngine` / `pat010DiatonicHex`.

Respects INTERFACES.md                    ✔
  Notes: No shared contract edits; chord edit path unchanged.

Respects UX_GUIDELINES.md (if UI task)   ✔
  Notes: §2 type scale for labels; §3 spacing; PAT-010 for degree accents.

Error handling present                    ✔
  Notes: Secondary handlers no-op safely when selection/chord missing (same as prior inspector).

Edge cases considered                     ✔
  Notes: Clear disabled when `secondary` is null; borrowed rows mirror diatonic density when listed.
─────────────────────────────────────────────────────
```

## Pattern used

- **PAT-010** — scale-degree colors for palette rows via `pat010DiatonicHex` (single source for hues).

## Pre-flight (before merge)

- [x] `tsc --build` clean  
- [x] `eslint` clean  
- [x] `npm test` (Vitest)  
- [x] `./scripts/ci-local.sh`  
- [x] Branch `phase-8/ui-palette-density`  

---

### STATUS_UPDATE (after PR opened)

```
STATUS_UPDATE
Task ID: UI-W7
Status: in-review
Branch: phase-8/ui-palette-density
PR: <fill on open>
Blocking flags: none
```
