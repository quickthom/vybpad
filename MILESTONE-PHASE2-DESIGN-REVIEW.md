# Milestone design review — Phase 2 (Grid Editor & Song State)

**Directive:** F-05 — Phase 2 milestone design review  
**Role:** Designer  
**Branch:** `phase-3/design-milestone-phase2-review`  
**Scope:** `client/src` editor shell (canvas, controls, measure strip), cross-check against `UX_GUIDELINES.md` and `ROADMAP.md` Phase 2 goals.

---

## Summary — shipped UX vs guidelines

### Aligned with `UX_GUIDELINES.md`

| Area | Evidence |
| --- | --- |
| **Color tokens (semantic usage)** | `App`, `EntryModeToggle`, `MeasureBar` use `var(--color-*, #hex)` Tailwind patterns with fallbacks matching §1 (e.g. `--color-app-bg`, `--color-surface`, `--color-border`, `--color-primary`, `--color-destructive`, `--color-focus-ring`). |
| **Canvas metrics (PAT-012 / §6)** | `engine/renderer/constants.ts`: `BEAT_WIDTH` 40px, `NOTE_HEIGHT` 20px, `CHORD_AREA_HEIGHT` 40px, `MEASURE_HEADER_HEIGHT` 24px, grid/bar/cursor/selection constants match §6 table. |
| **Chord / note blocks** | `chordBlocks.ts`, `noteBlocks.ts`: 6px chord corner radius, 4px note radius, PAT-010 blending, borders, label colors per §2 canvas typography and §6. |
| **Grid & measure numbers** | `gridBackground.ts`: measure number font stack, 11px / 600, `#374151` per §2. |
| **Selection / hover** | `EditorCanvas.tsx`: `SELECTION_COLOR`, blue selection stroke, hover stroke §6; cursor `grab` / `grabbing` §8. |
| **Playback cursor** | Same red `#EF4444`, 2px §6 (draw path when `playbackTick` set). |
| **Measure strip** | `MeasureBar`: height **56px**, `border-t`, `--color-border`, `--color-surface` §7 optional bottom strip. Selection fill `rgba(59,130,246,0.2)` and border `#2563EB` §6. `role="region"` `aria-label="Measures"`. |
| **Focus-visible** | Canvas, measure cells, entry toggle, buttons: `focus-visible:ring-2` + `--color-focus-ring` + offset §9. |
| **Destructive affordance** | Delete uses destructive outline + disabled state tokens §5.1 / §1. |
| **Keyboard / canvas chrome** | Canvas `role="application"`, `tabIndex={0}`, `aria-label` describing shortcuts §9. Measure cells `aria-pressed`. |
| **Guide tones** | `guideOverlay.ts` documents §6-style underline / brighten behavior. |
| **Entry mode (2.9)** | `EntryModeToggle`: secondary/outline pattern, focus ring, `aria-label` / `title`. |

### Partially aligned or intentionally reduced scope

| Topic | Status |
| --- | --- |
| **§7 full app shell** | **Not shipped.** No left chord palette, no right mixer / band / key-scale panels. `uiStore` holds `activePanels` but `App.tsx` does not render side panels or collapse rails. Acceptable as phased UI if called out in guidelines (see changelog below). |
| **§5.8 Toolbar / transport** | **Not present as specified.** Header is a wrapping title block + entry toggle, not a single **48px** toolbar row with grouped transport. No dedicated transport controls in Phase 2 shell. |
| **§1 CSS custom properties in `@theme`** | `index.css` is only `@import 'tailwindcss';` — no central `@theme` block. Components satisfy **semantic** colors via `var(--token, #fallback)`; fallbacks guarantee appearance without a global theme file. |
| **§4 Minimum width 1024px** | No full-viewport “wider display required” guard in `App` / routing. |

---

## Gaps and drift

1. **Touch targets (§9)** — `MeasureBar` “Add” / “Delete” use **h-8 (32px)**. §9 requires **≥44×44px** for chrome controls. Measure **cells** use `min-h-11 min-w-11` (44px) and align. **Recommendation:** Increase footer button hit area (`min-h-11`, padding, or wrap) in a follow-up task; guidelines updated to call out the measure strip explicitly (see `UX_GUIDELINES.md` changelog).
2. **Entry mode control** — `EntryModeToggle` is **h-8**; same touch-target gap unless considered “dense toolbar” with expanded target (it is not wrapped to 44px).
3. **Header height** — §3 / §5.8 imply a **48px** minimum toolbar band; current header uses `py-3` and can wrap, so height is not fixed **48px**. Acceptable for prototype shell; converge on **48px** row when transport/toolbar lands.
4. **Side panels** — §7 left/right **288px** regions absent. Track for Phase 3+ UI work; `UIStore.togglePanel` unused in `App`.
5. **Toasts / modals** — Not exercised in the Phase 2 editor route; PAT-001 error surfacing assumed when API shell exists. No drift for Phase 2 grid milestone per se.

---

## Recommendations (priority order)

1. **Polish (pre–Phase 7):** Meet §9 on **MeasureBar** actions and **EntryModeToggle** via `min-h-11`, `min-w-[44px]`, or padding wrappers; keep visual density with compact typography inside.
2. **Layout:** When adding transport, refactor header to a **48px** primary chrome row per §5.8; keep title/metadata in a second row only if breakpoints demand it.
3. **Viewport guard:** Implement §4 **&lt;1024px** full-screen message before mobile testing or public beta.
4. **Tokens:** Add Tailwind v4 `@theme` (or `:root`) mapping for §1 tokens once, then trim duplicated `#fallback` hex from class strings.
5. **Panels:** When implementing chord palette / mixer, apply §3 widths, **48px** collapsed rail, resize handle spec.

---

## Accessibility notes

- **Non-canvas UI:** Focus rings and `aria-` usage on header controls and `MeasureBar` support §9 baseline for chrome. Measure numbering buttons expose `aria-pressed` and descriptive `aria-label`.
- **Canvas:** Documented exemption §9 for per-cell semantics; `role="application"` + name + keyboard focus is appropriate. Focus ring on canvas matches §9 focus-visible pattern.
- **Contrast:** Token-based chrome follows light-theme palette (§1). Canvas chord/note label contrast logic in renderer aligns with §6 (light/dark label + shadow when needed).
- **Remaining risk:** Small **32px** footer/header controls fail **44px** touch minimum until addressed above. Screen reader users benefit from labels; motor accessibility still needs target size fix.

---

## `UX_GUIDELINES.md` changelog (this review)

**Version 1.1** (see file footer): Clarified (a) token deployment via `var(--token, #fallback)` pending central `@theme`, (b) phased delivery of §7 side panels, (c) measure-strip footer controls must meet §9 touch minimums.

---

## Files touched (Designer)

- `MILESTONE-PHASE2-DESIGN-REVIEW.md` (this document)
- `UX_GUIDELINES.md` (Designer-owned updates only)

No application code changes in this directive.
