# [UI-R2-W5.2] OB-14 render/hit rect alignment follow-up

**Base branch:** `develop`  
**Feature branch:** `phase-ui-r2/w5-2-ob14-render-hit`

---

### What was fixed this pass

- `diatonicRowToDegreeAndOctave` now maps negative diatonic rows without producing out-of-range `ScaleDegree` values.
- Added focused regression coverage in `client/tests/unit/engine/renderer/layout.test.ts` for negative row conversion.
- Kept drag conversion call sites unchanged so they use the now-safe canonical converter.

---

### ASSUMPTIONS

- Row-to-degree math is expected to preserve the existing forward mapping (`row = octave * 7 + (scaleDegree - 1)`).
- Only renderer math paths can be negative; song model validation and note data constraints remain unchanged.
- No additional UX behavior changes are part of this follow-up.

---

### Self-review checklist status

Status format: **PASS / FAIL / PENDING**.

- PASS: `ARCHITECTURE.md` alignment (Canvas renderer + pitch-axis math contract unchanged).
- PASS: `INTERFACES.md` alignment (no interface changes; only private layout helper behavior updated).
- PASS: `UX_GUIDELINES.md` alignment (no UI behavior/label copy/path changed).
- PASS: `layout.test.ts` regression coverage added and passing (`npm test -- client/tests/unit/engine/renderer/layout.test.ts`).
- PENDING: `tsc --build` — not run in this follow-up pass (deferred to CI/reviewer).
- PENDING: `eslint` — not run in this follow-up pass (deferred to CI/reviewer).
- PENDING: `npm test` full suite — not run in this follow-up pass (deferred to CI/reviewer).
- PASS: Checklist entries updated to reflect executed checks for this handoff.

---

### Blocking flags

- None.

