# Milestone design review — F-08 (Phase 5 advanced editor UX close)

**Directive:** F-08 — Phase 5 milestone UX review (chord palette, borrowed/secondary flows, key/scale and tempo/meter dialogs, multi-voice UI, measure strip wiring)  
**Role:** Designer  
**Branch reviewed:** `develop` at **`b14a349`** (TASK-5.9 #52 merged; Phase 5 tasks 5.1–5.9 complete on the line)  
**Scope:** Chord palette (`ChordPalette`, mode rail, `SecondaryChordInspector`), `KeyScaleChangeDialog` / `KeyScaleSelector`, `TempoMeterAtMeasureDialog` + `MeasureBar` integration, voice affordances in `EditorLayout` / `EditorCanvas` / `useKeyboard`, canvas voice-lane rendering. Out of scope: theory engine internals, playback scheduler logic (TASK-5.8 engine layer), backend — same discipline as F-07.

**ASSUMPTIONS:** Evidence was read from the tree at `b14a349`; Phase 5.8 “playback adaptation” is treated as non-UI for this pass unless reflected in chrome the user sees (transport already reviewed in F-07).

---

## Summary — shipped UX vs `UX_GUIDELINES.md` & `ROADMAP.md` Phase 5

### Aligned with `UX_GUIDELINES.md`

| Area | Evidence |
| --- | --- |
| **§1 Tokens / PAT-010** | `ChordPalette`: semantic `var(--color-*, #hex)`; diatonic/borrowed degree tiles use `pat010DiatonicHex` for preview fills (no duplicate palette constants). Chromatic/borrowed labeling follows product theory copy in borrowed rows. |
| **§2 Typography** | Palette headings `text-base font-semibold` → panel title tier; mode caption uses muted `text-xs`. `KeyScaleChangeDialog` title `h2` id `vybpad-key-scale-dialog-title`. `KeyScaleSelector` labels at 13px / legend at 12px → `label` / caption tier. |
| **§3 Layout — panels** | Left chord rail: `w-[288px] min-w-[240px] max-w-[400px]` when expanded; collapsed rail `w-12` (48px) — matches §3 panel dimensions. |
| **§5.1 / §5.3 / §5.4** | Palette degree buttons `min-h-[44px]`; borrowed `<select>` `min-h-11`. `KeyScaleSelector` selects `h-10`, radios `size-[18px]`. `SecondaryChordInspector` primary/secondary actions `h-11 min-h-11`. |
| **§5.6 Modal — key/scale** | `KeyScaleChangeDialog`: native `<dialog>`, overlay `backdrop:bg-[rgba(17,24,39,0.5)]`, width `min-w-[400px] max-w-[min(560px,calc(100vw-32px))]`, `rounded-xl` ≈ 12px, `p-6`, scrollable body `max-h-[min(560px,80vh)]`; `aria-labelledby` + `aria-modal="true"`. |
| **§5.8 Toolbar / advanced chrome** | Header: `Key / scale` opens dialog; `ChordPalette` mode segment (Diatonic / Borrowed) uses pressed styling and `min-h-11`. |
| **§6 Canvas — selection / measure strip** | `MeasureBar`: measure cells `min-h-11 min-w-11`, selection fill `rgba(59,130,246,0.2)` and border `#2563EB` per file header; footer `h-[56px]` per §7. |
| **§7 Regions** | Chord `aside` `role="complementary"` `aria-label="Chord palette panel"`; mixer panel when open matches right-region pattern. |
| **§8 — Phase 5 keyboard** | `useKeyboard.ts`: `d` secondary cycle, `i`/`e` inversion/embellishment (TASK-5.4); Ctrl/Cmd+`Digit1`–`Digit4` voice switch using `e.code` (TASK-5.7). Skips editable targets per §8. |
| **§9 — focus** | Palette buttons, inspector, dialogs: `focus-visible:ring-2` + `--color-focus-ring`. `KeyScaleChangeDialog` `onClose` restores focus to trigger via `queueMicrotask` + `keyScaleTriggerRef`. `TempoMeterAtMeasureDialog`: capture-phase Tab trap + `Escape`, restores `document.activeElement` on unmount. |
| **§9 — canvas** | `EditorCanvas`: `role="application"`, `tabIndex={0}`, `aria-label` mentions digit entry, durations, Delete, arrows, **Ctrl+1–4 melody voice**. |
| **Multi-voice display (TASK-5.7)** | `noteBlocks.ts`: `VOICE_LANE_Y_OFFSET_PX` vertical stagger; `drawNoteBlocks` paints voices 0→3 — lanes distinguishable without breaking PAT-010 fills. |
| **ROADMAP Phase 5 milestone (UI-facing)** | Borrowed palette + parallel scale selector; secondary cycling via keyboard + inspector; measure-level key/scale and tempo/meter dialogs; voice switching and per-voice note editing — reflected in components above. |

### Partially aligned or scope notes

| Topic | Status |
| --- | --- |
| **§4 Viewport (1024px)** | **Unchanged vs F-07.** `useMinViewport1024` is still only wired from `ProjectListPage`; `EditorLayout` does not block narrow viewports. P0 carry-over from F-06/F-07. |
| **`MeasureBar` Add / Delete** | **Partial.** **Tempo / meter** control uses `min-h-11 min-w-[44px]` (§9 measure-strip target). **Add** and **Delete** still use shared `h-8` classes — F-06 gap persists for those two controls. |
| **`EntryModeToggle`** | **Unchanged (F-06).** Still compact height; not introduced by Phase 5 but still visible beside new header controls. |
| **Secondary chords — palette mode** | **By design vs tabs.** `ChordPalette` `mode === 'secondary'` still renders a “coming later” placeholder, but `EditorLayout` only toggles `diatonic` \| `borrowed`. Secondary behavior is delivered via **`d`** + `SecondaryChordInspector` (ROADMAP TASK-5.3 emphasis on cycle) — no drift if product accepts keyboard-first secondary entry. |
| **`TempoMeterAtMeasureDialog` vs §5.6** | **Mostly aligned** (overlay color, panel width, padding). Implementation is **custom `fixed` overlay + `role="dialog"`** rather than native `<dialog>` — acceptable; focus behavior is explicitly implemented. Title uses `text-lg font-semibold` rather than the §5.6 `h2` token — minor typographic variance. |
| **Validation feedback** | On invalid tempo/meter input, UI sets **inline** `role="alert"` **and** `showErrorToast` — redundant for the same message; usable but noisy. |
| **Chord shortcut discoverability** | Canvas `aria-label` lists Ctrl+1–4 but does **not** mention `d` (secondary), `i` (inversion), `e` (embellishment) — power users rely on palette copy / inspector text. |
| **Borrowed tile `style={{ backgroundImage: … }}`** | Dynamic gradient over PAT-010 fill — same class of exception as F-07 mixer slider (PAT-008 / dynamic visualization). |

### Gaps and drift

1. **§4 — editor viewport guard** — Still the top integration gap; advanced panels add density without a narrow-viewport block.  
2. **§9 — `MeasureBar` Add/Delete** — Still below 44px visual height; **Tempo / meter** partially remediated.  
3. **Shortcut documentation parity** — Phase 5 adds important chord keys (`d`, `i`, `e`); canvas accessible name does not summarize them (help layer / §8 “documented in help” not yet centralized in UI).  
4. **Modal implementation split** — Key/scale uses native `<dialog>`; tempo/meter uses custom overlay. Not wrong, but increases Reviewer checklist surface (two focus-trap patterns).

---

## Recommendations (priority)

1. **P0 — Viewport:** Reuse F-06/F-07 P0 — apply `useMinViewport1024` (or shared wrapper) to **`EditorLayout`** so Phase 5 chrome matches §4.  
2. **P1 — Touch:** Raise **MeasureBar** **Add** / **Delete** to §9 targets (match **Tempo / meter** treatment). Revisit **EntryModeToggle** as in F-06.  
3. **P2 — Tempo/meter errors:** On validation failure, prefer **either** inline `role="alert"` **or** toast, not both for the identical string — or downgrade toast to non-redundant cases only.  
4. **P2 — Discoverability:** Extend in-app help or canvas `aria-label` / first-run hint to include **`d` / `i` / `e`** once copy length is acceptable — or a collapsible “Chord shortcuts” caption in the palette rail.  
5. **P3 — Modal consistency:** Document in `UX_GUIDELINES.md` when native `<dialog>` vs custom overlay is preferred (or standardize on one for new dialogs).

---

## `UX_GUIDELINES.md` changelog (F-08)

**Version 1.3 (proposed):** No file edit in this commit — milestone records Phase 5 surfaces as reviewed. If PM adopts P3, Designer may add a short §5.6 note on native vs custom dialog patterns and §8 cross-reference for advanced chord shortcuts.

---

## Files referenced (evidence)

| Path | Role |
| --- | --- |
| `client/src/components/panels/ChordPalette.tsx` | TASK-5.1 diatonic grid; TASK-5.2 borrowed mode + scale `<select>`; TASK-5.3 `SecondaryChordInspector`; placeholder secondary/search modes |
| `client/src/components/common/KeyScaleChangeDialog.tsx` | TASK-5.5 measure-level key/scale, metadata sync at measure 0 |
| `client/src/components/common/KeyScaleSelector.tsx` | Key + scale selects; parallel/relative radio groups |
| `client/src/components/controls/TempoMeterAtMeasureDialog.tsx` | TASK-5.6 tempo + meter at measure; focus trap, validation, toast |
| `client/src/components/controls/MeasureBar.tsx` | Measure selection, TASK-5.6 **Tempo / meter** entry |
| `client/src/components/MeasureBar.tsx` | Barrel re-export |
| `client/src/app/EditorLayout.tsx` | Palette mode state, `SecondaryChordInspector` wiring, voice readout, `KeyScaleChangeDialog` / `TempoMeterAtMeasureDialog`, `MeasureBar` `onEditTempoMeter` |
| `client/src/hooks/useKeyboard.ts` | TASK-5.3 `d`; TASK-5.4 `i`/`e`; TASK-5.7 Ctrl+digits |
| `client/src/components/editor/EditorCanvas.tsx` | `role="application"`, multi-voice hit testing, aria-label |
| `client/src/engine/renderer/noteBlocks.ts` | TASK-5.7 voice lane Y offset, multi-voice draw order |
| `client/src/components/editor/EntryModeToggle.tsx` | F-06 touch-target note (header-adjacent) |

---

## Integration note (PM)

- **TASK-5.9** (QA / Phase 5 test gate) merged as **#52**; this review treats **5.1–5.9** as complete on `develop` at **`b14a349`**.  
- **TASK-5.8** playback adaptation is assumed satisfied by engine/tests; UI review did not re-audit scheduler internals.  
- **Local verification:** Run `./scripts/ci-local.sh` before release integration if policy requires; no Designer changes to application code in this deliverable.
