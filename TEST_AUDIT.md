# E2E test coverage audit

**Date:** 2026-04-14  
**References:** `REQUIREMENTS.md` (Testing Standard, Acceptance Requirements), `ROADMAP.md`, `ARCHITECTURE.md` (Testing Strategy)

## ASSUMPTIONS

- “Completed work” is inferred from implemented features and existing tests under `client/tests/` (unit/component/e2e), not from a separate feature checklist.
- E2E scope is Playwright specs in `client/tests/e2e/` only; Vitest RTL/component tests satisfy part of the testing standard but are out of scope for this document except where they explain residual E2E gaps.

---

## How `REQUIREMENTS.md` maps to E2E

The **Testing Standard** requires real UI and user flows—not only prop/types—and evidence that behavior matches expectations (including things like playback highlighting, “verified however they can”). **Final acceptance** also depends on secure deployment, consistent UI, and StudioOne-related export workflows.

Implications for E2E:

| Requirement theme | E2E implication |
|---|---|
| DOM + user flows | Multi-step flows (auth, editor, transport) should be exercised in the browser. |
| Playback / feedback | Cursor and highlights are canvas-heavy; stable contract surfaces (transport readout, `data-testid`s) or visual baselines are needed for E2E-grade proof. |
| “Thoroughly tested” | Complement unit/component tests with a small set of **journey** tests (ROADMAP Phase 8.2 aligns with this). |
| StudioOne / MIDI | Automated E2E can validate **download / file shape**; DAW import remains a manual/HITL checkpoint unless tooling is added later. |

---

## Current E2E inventory (Playwright)

| Spec file | Primary coverage |
|---|---|
| `persistence.happy.spec.ts` | Register → project → **chord** entry (table mode, chord strip) → autosave → refresh → logout → login → persisted chords (API poll + reopen). |
| `playback-init.task-4-1.spec.ts` | Audio init via user gesture; toolbar readiness; reload; rapid play during init (no errors). |
| `piano-samples.task-4-2.spec.ts` | Deferred sample load, reload path, rapid play during load, **blocked** sample fetch → user-visible failure (no crash). |
| `harmony-voicing-playback.task-4-3.spec.ts` | API-seeded heavy / edge chord progressions → play → **no page/console errors**; refresh replay. |
| `playback-surface.task-4-10.spec.ts` | After play, **transport measure:beat readout** advances (proxy for playback progression). |
| `phase5-advanced-feature-sweep.task-5-9.spec.ts` | Seeded Phase 5 fixture: palette borrowed tab, applied-chord UI, key/tempo dialogs scoped to measures, voice switch, play until readout shows **measure 9**. |

**Harness:** `playwright.config.ts` runs Chromium, `client/tests/e2e`, optional devstack via `PLAYWRIGHT_SKIP_WEBSERVER`.

**Strengths:** Solid coverage of **auth + persistence happy path**, **audio lifecycle** (init, samples, failure), **playback progression** via transport readout, and a **Phase 5 shell + long-play** sweep.

**Limits:** Little or no E2E for **melody editing**, **export**, **project list management**, **loop/mixer/tempo/stop**, **undo/redo**, or **canvas-specific** highlight assertions (partially delegated to unit/component tests per `ARCHITECTURE.md`).

---

## Already planned in `ROADMAP.md` (do not re-scope as “missing”)

These are explicitly scheduled; treat them as **roadmap-backed** rather than ad-hoc gaps:

- **8.2** — Full user workflow E2E: register → create → compose → play → export  
- **8.3** — Visual regression baselines (Playwright screenshots)  
- **8.4** — Accessibility (e.g. axe-core, keyboard for non-canvas UI)  
- **7.10** — Shortcut E2E tests (Phase 7)  

The recommendations below include **concrete test ideas** that support those tasks and fill gaps **for shipped phases** where E2E is still thin.

---

## Recommended additional E2E tests (by importance)

### High

1. **End-to-end composition + export stub (supports ROADMAP 8.2)**  
   Single spec: register (or login) → create project → enter at least one **melody** event (notes) and chords → play → trigger **MIDI export** → assert download (or blob) and **minimal file sanity** (e.g. non-empty, expected header/track count via fixture or server-side check if introduced). Aligns with acceptance **StudioOne/MIDI** and the testing standard’s “ordinary session” workflow.

2. **Melody persistence**  
   Extend or add a spec that enters notes (not only chords), waits for autosave, refreshes, and confirms **note events** present via `GET /api/projects/:id` (same pattern as chord polling in `persistence.happy.spec.ts`). Reduces risk that only harmony is covered E2E.

3. **Transport controls beyond Play**  
   E2E for **Stop**, **rewind/to start**, and **Pause** in combination with advancing readout (already partially used in `playback-surface.task-4-10.spec.ts`). Ensures the “ordinary session” transport bar does not regress.

4. **Loop region (Phase 4.8)**  
   If loop UI is considered shipped: set loop, play, assert readout **wraps/stays within** loop or repeats (behavior as specified in product). High user visibility; currently covered in component/unit tests only.

### Medium

5. **Login-only path**  
   Register is covered; add **login → projects → editor** to guard cookie/token bootstrap without the register branch.

6. **Project list operations**  
   Create second project, **switch**, **delete** (with confirmation if any), assert list updates. Guards CRUD beyond the editor shell.

7. **Manual Save**  
   Dirty document → **Save** enabled → click → eventually disabled / “saved” state; optional API GET confirms revision (if exposed). Complements autosave-only coverage.

8. **Mixer panel**  
   Assert **mute/slider** change observable state (e.g. `aria-pressed`, disabled transport substate if applicable). Audio level is not asserted in E2E (appropriate).

9. **Undo / redo one operation**  
   One destructive edit (e.g. delete chord or note) → undo → redo → assert via API or visible Roman/numeric label if stable selectors exist.

10. **Tempo / meter change from UI**  
    Change tempo in toolbar or dialog, assert readout or tick progression changes relative to baseline (may reuse Phase 5 fixture patterns).

11. **Visual baseline for 1–2 editor states (supports ROADMAP 8.3)**  
    Screenshot compare: empty grid vs populated seeded song. Reduces canvas blind spot vs pure unit renderer tests.

12. **Axe pass on shell routes (supports ROADMAP 8.4)**  
    Login, projects, editor chrome (not canvas internals): automated **axe** run in Playwright to meet accessibility direction.

### Low

13. **Guide tone / overlay toggle**  
    If exposed in settings: toggle and assert **data/state** or non-crash with play.

14. **Text vs table entry mode**  
    Switch entry mode, single chord/note entry, assert no crash and persisted data (if semantics are stable).

15. **Measure bar: add/delete measure**  
    User-visible measure count or seeded fixture reload after measure add.

16. **Chord palette click-to-insert**  
    Complements keyboard-only persistence; one diatonic chord from palette.

17. **Network degradation (additive)**  
    Beyond sample abort: slow API responses during save (flaky behavior guard) — optional, higher maintenance.

18. **Secondary/borrowed “edit” depth**  
    Phase 5 sweep validates **presence** and long playback; optional spec that **places** a borrowed/secondary chord and verifies persistence (if stable selectors exist).

---

## Summary

E2E coverage is **strong** for persistence (chords), **audio initialization and sample failure**, **playback progression** (transport readout), and a **Phase 5 milestone sweep**. Against `REQUIREMENTS.md`, the largest **E2E gaps** are a **full compose → play → export** journey, **melody**-side persistence, richer **transport/loop/mixer** interactions, and **accessibility/visual** baselines already called out in **ROADMAP Phase 8**. Prioritize **High** items to align the automated suite with the stated acceptance bar and Phase 8.2; use **Medium/Low** to deepen regression safety without duplicating well-covered unit/component areas.
