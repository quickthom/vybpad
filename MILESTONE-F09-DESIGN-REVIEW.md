# Milestone design review — F-09 (Phase 6 MIDI export & StudioOne integration)

**Directive:** F-09 — Phase 6 milestone UX review (transport MIDI download, drag-to-DAW, export clustering)  
**Role:** Designer  
**Branch reviewed:** `develop` at **`d3b03fe`** (`origin/develop` at time of review; Phase 6 tasks archived through TASK-6.7)  
**Scope:** `MidiExportControls`, `MidiDragExportControl`, `TransportControls` `endContent`, `useMidiDragExport`, `EditorLayout` wiring, `ToastHost` feedback for drag. Out of scope: `midi-writer-js` / exporter math (#53–#55, #58), server API — same discipline as F-08.

**ASSUMPTIONS:** Evidence was read from the tree at `d3b03fe`. Engine-only PRs (#53–#55, #58) are skimmed for UI impact; none add editor chrome beyond what #56/#57 merged.

---

## Summary — shipped UX vs `UX_GUIDELINES.md` & Phase 6 goal

### Aligned with `UX_GUIDELINES.md`

| Area | Evidence |
| --- | --- |
| **§1 Tokens** | `MidiExportControls`, `MidiDragExportControl`, `TransportControls`: `var(--color-*, #hex)` fallbacks; borders, text, focus ring use semantic tokens. |
| **§3 / §5.8 Transport row** | `TransportControls`: `min-h-12` (48px band), `border-b`, `role="toolbar"` `aria-label="Transport"`, playback group, `aria-live="polite"` on beat display, init spinner + `role="status"` when loading, `role="alert"` for init errors. |
| **§5.8 MIDI export cluster** | `EditorLayout` passes `endContent`: `MidiExportControls` (mode select + download) + `MidiDragExportControl`. Trailing block uses `ml-auto` + `gap-2`; drag control `min-h-11 min-w-11`, **copy** cursor, `aria-label` on draggable button. |
| **§5.3 Select** | Export mode `<select>`: `min-h-11`, token borders/focus, options for full song vs melody. |
| **§8 Drag affordances** | `useMidiDragExport`: `effectAllowed = 'copy'`, `MIDI_DRAG_TOAST_MESSAGE` matches §8 / §373 copy (“Dragging MIDI…”). |
| **§5.7 / §9 Toasts** | `ToastHost`: bottom-right `bottom-4 right-4`, width `min(400px, …)`, `role="alert"` + assertive for error, `role="status"` + polite for success path used at drag start; dismiss control with `aria-label`. |
| **§9 Focus** | Export buttons and select: `focus-visible:ring-2` + `--color-focus-ring` + offset. |

### Partially aligned or scope notes

| Topic | Status |
| --- | --- |
| **§5.7 four-type table vs implementation** | Client implements **error \| success** toasts only. MIDI drag start uses **`showSuccess`** — **polite** live region and non-blocking behavior are correct; **visual** accent is **success** (green) while the message is **operational**, not completion. **Documented in §5.7 (v1.3)** as interim until an **info** variant exists. |
| **§9 Nested `role="group"`** | `TransportControls` wraps `endContent` in `role="group"` `aria-label="Export"`; `MidiExportControls` root is `role="group"` `aria-label="MIDI export"`. Redundant for AT; **§5.8 / §9 (v1.3)** prefer consolidating in new work. |
| **§2 Label tier** | “Export” label uses `text-sm` (14px) vs **`label`** (13px) — minor; **§5.8** allows adjacent-transport deviation. |
| **§4 Viewport (1024px)** | **Unchanged vs F-08.** Editor route guard remains a carry-over; not introduced by Phase 6. |

### Gaps and drift (follow-up)

1. **Info toast variant** — Optional Builder pass: add `showInfo` + `--color-info` accent so MIDI drag feedback matches §5.7 **info** row without reusing success chrome.  
2. **Single ARIA group** — Optional: remove duplicate group wrapper (transport vs `MidiExportControls`) per **§5.8 / §9**.  
3. **§4 P0** — Viewport guard on `EditorLayout` remains the top integration gap from prior milestones.

---

## Recommendations (priority)

1. **P2 — Toast semantics:** Implement **info** toast (or map drag to a dedicated non-success variant) when convenient — aligns with **§5.7** and reduces “success” misuse.  
2. **P3 — ARIA:** Flatten export region to one `role="group"` + one `aria-label` when touching this area again.  
3. **P0 (carry-over)** — **§4** editor viewport guard — unchanged from F-08.

---

## `UX_GUIDELINES.md` changelog (F-09)

**Version 1.3:** §5.7 **Implementation vs. the four-type table** (binary toast layer, interim success chrome for transient MIDI drag feedback). §5.8 **MIDI export cluster** (anatomy, targets, labels, grouping note). §9 **Toolbar** bullet — nested `role="group"` avoidance. §10 Review checklist — MIDI export line.

---

## Files referenced (evidence)

| Path | Role |
| --- | --- |
| `client/src/components/controls/MidiExportControls.tsx` | TASK-6.4: mode select, download, filename helpers |
| `client/src/components/controls/MidiDragExportControl.tsx` | TASK-6.5: draggable MIDI control |
| `client/src/components/controls/TransportControls.tsx` | `endContent` slot, toolbar semantics |
| `client/src/hooks/useMidiDragExport.ts` | Drag data transfer + toast constant |
| `client/src/app/EditorLayout.tsx` | Composes transport + export cluster |
| `client/src/components/common/ToastHost.tsx` | Toast placement, `role` / `aria-live` |

---

## Integration note (PM)

- **Phase 6** tasks **6.1–6.7** are reflected in `TASK_STATUS_ARCHIVE.md` (PRs #53–#58); UI-facing work is **#56** (drag blob) and **#57** (export UI + transport `endContent`).  
- **TASK-6.6** (HITL StudioOne validation) has no merge artifact; product checklist remains with PreSonus host when available.  
- **Local verification:** Run `./scripts/ci-local.sh` per team policy; this deliverable updates **`UX_GUIDELINES.md`** and adds this review artifact only — no application code.
