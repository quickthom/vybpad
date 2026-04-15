# Design follow-up tasks (consolidated)

**Purpose:** Single backlog of items raised across milestone design reviews in the repo root. Items are **deduplicated** and ordered by **severity** (most impactful / blocking first).  
**Sources:** `MILESTONE-PHASE2-DESIGN-REVIEW.md` (F-05), `MILESTONE-F06-DESIGN-REVIEW.md`, `MILESTONE-F07-DESIGN-REVIEW.md`, `MILESTONE-F08-DESIGN-REVIEW.md`.  
**Last consolidated:** 2026-04-14 (Designer pass — codebase spot-check: viewport guard still only on project list; `MeasureBar` Add/Delete and `EntryModeToggle` still `h-8`).

**Ownership:** Implementation tasks default to **Builder** unless noted as **Designer** (`UX_GUIDELINES.md` only).

---

## Critical — layout / access (§4)

| ID | Task | Source |
| --- | --- | --- |
| **D-01** | Apply the **minimum 1024px viewport guard** app-wide per UX_GUIDELINES §4: wire `useMinViewport1024` (or a shared route wrapper) to **`EditorLayout`** and **auth routes** (`/login`, `/register`), not only `ProjectListPage`. Advanced editor chrome is unusable on narrow viewports without this. | F-06 P0; F-07; F-08; Phase 2 rec #3 |

---

## High — motor accessibility / touch (§9)

| ID | Task | Source |
| --- | --- | --- |
| **D-02** | **`MeasureBar` Add / Delete:** Raise controls from **`h-8` (32px)** to meet **≥44×44px** hit targets (e.g. `min-h-11`, padding, or hit-area wrapper). **Tempo/meter** was partially remediated in Phase 5; Add/Delete remain the recurring gap. | F-05–F-08 |
| **D-03** | **`EntryModeToggle`:** Same §9 treatment — currently **`h-8`**; align with measure-strip / chrome minimums. | F-05–F-08 |
| **D-04** | **`TransportControls`:** Buttons are **40px** visual height; §9 allows 40px **if** the **hit area** extends to 44px (padding) **or** document a **dense-toolbar exception** in `UX_GUIDELINES.md` so Reviewer/QA can verify consistently. | F-06; F-07 |

---

## Medium — UX quality, consistency, noise

| ID | Task | Source |
| --- | --- | --- |
| **D-05** | **Autosave feedback:** If product requires “sees it auto-save” as *visible* feedback (ROADMAP vs silent persist), add a non-toast affordance (e.g. last-saved line). **TL/product call** — optional if silent autosave stays acceptable. | F-06 P2 |
| **D-06** | **Auth primary submit focus:** Align `LoginForm` / `RegisterForm` submit **`focus-visible`** with §5.1 **ring** pattern (currently outline vs 2px ring elsewhere). | F-06 |
| **D-07** | **Project list empty state:** Strengthen §8 alignment when count is 0 (heading + primary CTA pattern vs minimal copy). | F-06 P3 |
| **D-08** | **Loop bar — sighted discoverability:** Optional chip/badge when looping is active (beyond `sr-only` live region). | F-07 P2 |
| **D-09** | **Loop fields:** Optional measure:beat framing instead of raw ticks only (power-user honesty vs readability). | F-07 |
| **D-10** | **Playback highlight:** Audit renderer vs UX §6 for **active chord/note at `playbackTick`** (amber outline / tint); align implementation or document intentional deviation. | F-07 P3 |
| **D-11** | **`TempoMeterAtMeasureDialog` validation:** On failure, prefer **either** inline `role="alert"` **or** toast — **not both** for the same string (reduces redundant noise). | F-08 |
| **D-12** | **Chord shortcuts discoverability:** Surface **`d` / `i` / `e`** (and consistency with §8) via canvas `aria-label`, in-app help, or palette rail — canvas label currently emphasizes Ctrl+1–4 only. | F-08 |

---

## Lower — polish, tokens, documentation (Designer-led or multi-sprint)

| ID | Task | Source |
| --- | --- | --- |
| **D-13** | **Centralize design tokens:** Add Tailwind v4 `@theme` or `:root` mapping for §1 tokens once; trim duplicated `#fallback` hex in class strings when safe. | Phase 2; F-06 |
| **D-14** | **Header / toolbar structure:** When converging chrome, prefer a stable **48px** primary row per §5.8; keep title/metadata secondary if wrapping is required (Phase 2 noted header was not fixed-height). | Phase 2 |
| **D-15** | **`UX_GUIDELINES.md` — loop row + playback:** If TL adopts F-07 P2/P3, add explicit §5.8 / §6 notes for loop row behavior and playback highlight (F-07 proposed v1.3 text). | F-07 |
| **D-16** | **`UX_GUIDELINES.md` — dialogs:** Short §5.6 note on **native `<dialog>` vs custom overlay** (when to use which; focus-trap expectations). Cross-reference §8 for advanced chord shortcuts if helpful. | F-08 P3 |
| **D-17** | **Reviewer checklist:** Confirm `DeleteProjectDialog` Escape/backdrop behavior is acceptable with native `<dialog>` (F-06 note — likely OK). | F-06 |

---

## Out of scope / resolved by later phases (historical)

| Note | Detail |
| --- | --- |
| **§7 side panels** | Phased delivery; chord palette and mixer landed in later work — no longer an open “missing panels” gap for current milestone scope. | Phase 2 |
| **§5.8 transport row** | Transport shipped; remaining issue is **touch hit-area** (D-04), not absence of transport. | F-06+ |

---

## Suggested execution order

1. **D-01** (viewport on editor/auth) — unblocks consistent §4 compliance and reduces bad mobile/cramped experiences.  
2. **D-02**, **D-03**, **D-04** (touch targets + transport clarification) — closes recurring §9 findings.  
3. **D-11**, **D-12**, **D-08**–**D-10** as TL prioritizes product polish.  
4. **D-13**–**D-16** when scheduling a guidelines/token pass with Designer.
