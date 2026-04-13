# UX Guidelines — vYbpad

> Canonical UI/UX standards for the vYbpad client. Only the Designer may modify this file.  
> Implementation: React 18 + Tailwind CSS 4 (see `ARCHITECTURE.md`). Styling rules follow **PAT-008** (Tailwind utilities; no inline styles on React chrome — canvas drawing uses imperative API values defined here and in **PAT-012**).

---

## 1. Design tokens and Tailwind mapping

Builders MUST expose the semantic tokens below as CSS custom properties (recommended: `@theme` in Tailwind v4) so utilities can reference them consistently, e.g. `bg-[var(--color-surface)]` or mapped theme keys.

**Interim:** Until a single global `@theme` (or `:root`) block lands, using Tailwind arbitrary values such as `bg-[var(--color-surface,#FFFFFF)]` — **same hex as the table below** — satisfies this rule. Reviewers treat the fallback hex as the canonical value for that token until centralized theme CSS exists.

| Token | Hex | Usage |
| --- | --- | --- |
| `--color-app-bg` | `#F3F4F6` | Application background (behind panels and editor chrome) |
| `--color-surface` | `#FFFFFF` | Panel body, cards, modal surface |
| `--color-surface-muted` | `#F9FAFB` | Inset areas, table stripes, disabled field fill |
| `--color-border` | `#E5E7EB` | Default dividers, input borders (rest) |
| `--color-border-strong` | `#D1D5DB` | Hover state for borders, scroll track edge |
| `--color-text-primary` | `#111827` | Primary body and labels |
| `--color-text-secondary` | `#4B5563` | Secondary labels, metadata |
| `--color-text-muted` | `#9CA3AF` | Placeholder, captions, inactive tab text |
| `--color-text-on-primary` | `#FFFFFF` | Text on primary buttons and primary-filled badges |
| `--color-primary` | `#4F46E5` | Primary actions, focused control accent, link text |
| `--color-primary-hover` | `#4338CA` | Primary control hover background |
| `--color-primary-active` | `#3730A3` | Primary control active/pressed |
| `--color-destructive` | `#DC2626` | Delete, irreversible actions, error emphasis |
| `--color-destructive-hover` | `#B91C1C` | Destructive hover |
| `--color-success` | `#16A34A` | Success toast, positive confirmation |
| `--color-warning` | `#D97706` | Warnings, non-blocking issues |
| `--color-info` | `#0284C7` | Informational toasts (not errors) |
| `--color-focus-ring` | `#4F46E5` | Focus ring color (same hue as primary) |

**Semantic usage**

- **Primary actions** (Save, OK, Create project, Register): filled `--color-primary` background, `--color-text-on-primary` text; hover/active use `--color-primary-hover` / `--color-primary-active`.
- **Secondary actions** (Cancel, Back): outline style — `border` `--color-border-strong`, text `--color-text-primary`, background `--color-surface`; hover: background `--color-surface-muted`.
- **Tertiary / ghost** (toolbar overflow, inline actions): text `--color-primary` or `--color-text-secondary` on transparent; hover background `--color-surface-muted`.
- **Destructive** (Delete project): text `--color-destructive`; filled variant only for the single primary destructive control in a dialog (e.g. “Delete permanently”).
- **Disabled**: text `--color-text-muted`, background `--color-surface-muted`, border `--color-border`, cursor `not-allowed`, no shadow.
- **Selected / pressed toggle**: background `--color-surface-muted`, border or ring `--color-primary`, text `--color-text-primary`.

**Scale-degree colors (chords, notes, palette swatches)**

Do **not** duplicate the degree→hex table in application constants for the authoritative palette. Use **PAT-010** in `PATTERNS.md` (Diatonic-centric and Major-centric schemes). UI that shows a degree swatch MUST derive fill from the same mapping as the canvas renderer for consistency.

**Chromatic / non-diatonic display**

Follow **PAT-010** and **PAT-017**: desaturated/muted fill vs diatonic; `♭` / `♯` prefixes for chromatic offsets in labels.

**Dark theme**

Deferred. Do not ship a dark theme until this file adds a dedicated “Dark theme” section with full token values. Until then, ship **light theme only**.

---

## 2. Typography

**UI font stack (panels, toolbar, forms, project list, auth)**

```text
ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif
```

**Monospace stack** (timestamps, optional BPM raw input, technical IDs in dev-only UI)

```text
ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace
```

**Type scale** (use these pixel sizes at default zoom; map to Tailwind `text-*` or arbitrary sizes as needed)

| Role | Size | Line height | Letter spacing | Weight |
| --- | --- | --- | --- | --- |
| `display` | 28px | 1.2 | -0.02em | 600 |
| `h1` | 24px | 1.25 | -0.02em | 600 |
| `h2` | 20px | 1.3 | -0.01em | 600 |
| `h3` | 16px | 1.35 | 0 | 600 |
| `body` | 14px | 1.5 | 0 | 400 |
| `body-strong` | 14px | 1.5 | 0 | 600 |
| `label` | 13px | 1.4 | 0.01em | 500 |
| `caption` | 12px | 1.4 | 0.02em | 400 |
| `overline` | 11px | 1.3 | 0.06em | 500 |

**Heading hierarchy**

- Page titles (auth, project list): `h1`.
- Panel titles (Mixer, Chord palette): `h3`.
- Section titles inside settings/modals: `h2` if standalone section; `h3` if nested under a modal title.
- Never skip levels for visual effect only — use weight/size tokens, not arbitrary larger jumps.

**Canvas label typography** (drawn on canvas, not DOM — use equivalent pixel sizes at 1x zoom)

| Element | Font | Size | Weight | Color |
| --- | --- | --- | --- | --- |
| Measure numbers | UI stack | 11px | 600 | `#374151` |
| Beat subdivision labels (if shown) | UI stack | 10px | 400 | `#9CA3AF` |
| Chord symbol in block | UI stack | 12px | 600 | `#111827` (ensure contrast vs PAT-010 fills; if insufficient, use white `#FFFFFF` with 1px subtle shadow — see §6) |
| Scale degree in note block | UI stack | 11px | 600 | `#111827` or `#FFFFFF` per contrast |
| Roman numeral / small chord hint (if displayed) | UI stack | 10px | 500 | `#1F2937` |

---

## 3. Spacing and layout

**Base unit:** **4px**. All spacing MUST be multiples of 4px.

**Scale** (use these values for margin, padding, gap)

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

**Structural dimensions**

| Element | Value |
| --- | --- |
| Toolbar height | **48px** minimum touch target row; content vertically centered |
| Transport bar row | Same band as toolbar or stacked **48px** row below if split |
| Panel default width (chord palette, mixer, band) | **288px** |
| Panel minimum width (when resizable) | **240px** |
| Panel maximum width (when resizable) | **400px** |
| Panel padding (inner) | **16px** horizontal, **12px** vertical for dense lists; **16px** all sides for forms |
| Collapsed panel rail width | **48px** (icon-only affordance) |
| Resize handle hit area | **8px** wide invisible target; **1px** visible line at `--color-border-strong` |
| Gap between toolbar groups | **16px** |
| Modal padding | **24px** |
| Form field vertical gap | **16px** between groups; **8px** between label and control |

**Grid (app chrome, not piano roll)**

- Content max-width for centered auth/project list: **480px** on `--color-app-bg`.
- Editor area: fluid; no max-width.

---

## 4. Breakpoints and minimum viewport

**Minimum supported width:** **1024px** (per `ROADMAP.md` Phase 7.9).

- Layout, spacing, and panel defaults above assume **≥1024px**.
- Below 1024px: Builders SHOULD show a full-viewport message: brief explanation that a wider display is required, no interactive editor. Copy: use `body` size, centered, `--color-text-secondary`; optional link to documentation — keep minimal.

**Where the guard applies (F-06):** Any route that renders the **interactive grid editor** MUST use the same blocking pattern (e.g. shared `useMinViewport1024` hook or layout wrapper). The project list alone is not sufficient — users can deep-link or navigate to `/editor/:id` below 1024px otherwise. **Login/register** SHOULD use the same guard or an equivalent full-viewport message so auth and editor expectations stay consistent.

**Breakpoints** (for future responsive work; not required to ship adaptive layouts in MVP beyond the minimum-width guard)

| Name | Min width | Intended behavior |
| --- | --- | --- |
| `lg` | 1024px | Default target; full layout |
| `xl` | 1280px | Optional extra horizontal padding for project list |
| `2xl` | 1536px | Optional wider editor margins only |

---

## 5. Core component patterns

All interactive components: **hover** and **focus-visible** states required; **disabled** state must remove pointer events where appropriate and use §5.9 focus rules.

### 5.1 Button

**Anatomy:** Optional leading icon (16px), label, optional trailing chevron for menus.

**Variants**

| Variant | Default | Hover | Focus-visible | Active/pressed | Disabled |
| --- | --- | --- | --- | --- | --- |
| Primary | `primary` bg, on-primary text | `primary-hover` bg | 2px ring offset | `primary-active` bg | §1 disabled |
| Secondary | surface bg, border strong, primary text | surface-muted bg | 2px ring | border primary | §1 disabled |
| Ghost | transparent, text secondary | surface-muted bg | ring | surface-muted | §1 disabled |
| Destructive outline | surface, border destructive text destructive | light red tint bg `#FEF2F2` | ring | darker tint | §1 disabled |

**Sizes**

- **Default:** height **40px**, horizontal padding **16px**, radius **8px**.
- **Compact:** height **32px**, padding **12px** horizontal, radius **6px** (dense toolbars).
- **Icon-only:** **40×40px** default; **36×36px** compact; icon **20px** (lucide-style stroke 2px). Tooltip with `aria-label` or `title` required.

**Toggle / pressed** (tool buttons): when `aria-pressed="true"`, use selected state from §1; focus ring still required.

**When not to use:** Do not use primary for destructive actions. Do not nest interactive buttons inside each other.

### 5.2 Input (text, email, password)

- Height **40px**; padding **12px** horizontal; radius **8px**; border **1px** `--color-border`; background `--color-surface`.
- **Hover:** border `--color-border-strong`.
- **Focus:** border `--color-primary`, box-shadow `0 0 0 1px var(--color-primary)` (or ring), no browser default outline (replaced).
- **Error:** border `--color-destructive`, helper text below in `--color-destructive`, `caption` size, `role="alert"` on message.
- **Disabled:** §1 disabled styles.

### 5.3 Select

- Same dimensions and borders as input. Chevron indicator **16px**, right **12px** padding end.
- Dropdown panel: `--color-surface`, shadow `0 10px 15px -3px rgb(0 0 0 / 0.1)`, radius **8px**, max-height `min(320px, 50vh)`, scroll as needed.
- Options: **40px** row height; keyboard highlight background `--color-surface-muted`.

### 5.4 Checkbox and radio

- Checkbox **18px**, radio **18px** diameter; border `--color-border-strong`; checked fill `--color-primary`; focus ring on wrapper.
- Label uses `label` typography, **8px** gap from control (use `gap-2` in flex).

### 5.5 Slider (mixer volume, tempo fine-tune if present)

- Track height **6px**, radius full; track background `#E5E7EB`; fill `--color-primary` from left to thumb.
- Thumb **16px** circle, `--color-surface`, border **2px** `--color-border-strong`, shadow sm; hover: `--color-primary` border.
- **Output:** optional numeric label `caption` to the right; mute button **icon-only** variant adjacent.

### 5.6 Modal / dialog

- **Overlay:** `rgba(17, 24, 39, 0.5)` (`#111827` at 50%).
- **Panel:** min-width **400px**, max-width `min(560px, calc(100vw - 32px))`; radius **12px**; padding §3.
- **Header:** `h2` for title; close button top-right **icon-only** ghost **32px**.
- **Footer:** actions right-aligned; primary destructive last in LTR; **12px** gap between buttons.
- **Scroll:** body scrolls if content exceeds `max-height: min(560px, 80vh)`.
- **Focus trap** and **Escape** to close (unless destructive confirm must type name — then optional). See §8.

### 5.7 Toast / notification

Aligned with **PAT-001**: API and client errors surface via toast; map codes in a central `errorMessages` module.

| Type | Icon color cue | Border-left or accent | Duration |
| --- | --- | --- | --- |
| Error | destructive | 4px solid `--color-destructive` | 6s or manual dismiss |
| Warning | warning | 4px solid `--color-warning` | 5s |
| Success | success | 4px solid `--color-success` | 4s |
| Info | info | 4px solid `--color-info` | 4s |

- Position: **bottom-right**, **16px** from edges, stack with **8px** gap.
- Width: **min(400px, 100vw - 32px)**; padding **16px**; radius **8px**; shadow lg; background `--color-surface`.
- Content: `body-strong` title line + optional `caption` detail; dismiss button icon-only.

### 5.8 Toolbar and transport

- **Single horizontal bar** **48px**: background `--color-surface`, bottom border **1px** `--color-border`.
- **Grouping:** related controls in **flex** with **8px** internal gap; groups separated by **1px × 24px** vertical divider `--color-border` or **16px** horizontal margin.
- **Icon buttons:** **40px** hit area; playing state may use `--color-primary` fill for active transport icon.
- **Tempo / key / meter:** use **compact** selects or **ghost** buttons opening popovers/modals per feature spec.

**Phased delivery:** Transport chrome (play/pause/stop/rewind, tempo, audio-init loading state) may ship in an early milestone before the full `ROADMAP.md` Phase 4 playback feature set; all such controls still follow the table above, including `aria-live` / `role="toolbar"` and error surfacing for init failures.

### 5.9 Form layout (auth, settings)

- Labels above fields; **required** indicated with `*` and `aria-required="true"`.
- Submit row: primary full-width on mobile-narrow forms; on wider modals **auto** width right-aligned.
- **Validation:** on submit + on blur for touched fields; inline errors per **5.2**.

### 5.10 Navigation (project list, app shell)

- **Project list:** list/table hybrid — row height **56px**, hover `--color-surface-muted`; primary click target entire row; actions (⋯) **icon-only** at row end.
- **Destructive row action** (delete): confirm via modal, not inline undo only.

---

## 6. Canvas-specific conventions

Values align with **PAT-012**; this section is the UX authority for Builders (supersedes ad-hoc tweaks). Zoom scales pixel values unless noted.

| Constant | Value | Notes |
| --- | --- | --- |
| `BEAT_WIDTH` | 40px | At zoom 1.0 |
| `NOTE_HEIGHT` | 20px | One diatonic row |
| `CHORD_AREA_HEIGHT` | 40px | Chord staff band |
| `MEASURE_HEADER_HEIGHT` | 24px | Measure numbers / change markers |
| `GRID_LINE_COLOR` | `#E5E7EB` | Beat subdivisions |
| `BAR_LINE_COLOR` | `#6B7280` | Measure boundaries |
| `PLAYBACK_CURSOR_COLOR` | `#EF4444` | |
| `PLAYBACK_CURSOR_WIDTH` | 2px | |
| `SELECTION_COLOR` | `rgba(59, 130, 246, 0.2)` | Range / multi-select fill |

**Chord blocks**

- **Geometry:** height = `CHORD_AREA_HEIGHT`; width from tick duration × `BEAT_WIDTH` × zoom.
- **Corners:** **6px** radius (proportional feel with Hookpad-like blocks).
- **Fill:** PAT-010 degree color at **85%** opacity over white `#FFFFFF` base **or** solid with slightly lightened hex — preserve hue from PAT-010.
- **Border:** **1px** `#000000` at **12%** opacity (or `#D1D5DB` if higher contrast needed on light fills).
- **Text:** centered horizontally and vertically; chord symbol §2 canvas typography; if contrast < 4.5:1 against fill, switch label to **white** with `text-shadow: 0 1px 2px rgba(0,0,0,0.35)`.

**Note blocks**

- **Shape:** rounded rect **4px** radius, height = `NOTE_HEIGHT - 2px` (1px inset vertically), width from ticks.
- **Border:** **1px** `#1F2937` at **35%** opacity.
- **Fill:** PAT-010 with same refinement as chords; chromatic: muted per PAT-010/017.
- **Rest:** gray hatch or hollow rectangle — fill `#F3F4F6`, border dashed `#9CA3AF`.

**Octave indicator**

- Small **caption**-sized superscript or subscript digit to the right of the degree numeral when `octave !== 0`, e.g. degree “3” + superscript “+1”; color `--color-text-secondary` equivalent on canvas: `#4B5563`.

**Guide tones** (when enabled)

- Highlight compatible chord tones with a **soft underline** or **10%** brighter fill vs same degree base — must not obscure degree text; implementation detail left to renderer with review against PAT-010 hue.

**Selection**

- Fill: `SELECTION_COLOR`; **outline** **1px** `#2563EB` (`#2563EB` at 80% opacity acceptable).

**Hover** (non-playing)

- Hovered event under cursor: **1px** outline `#3B82F6` at 70% opacity, no fill change **or** +5% luminance on fill — pick one per event type and stay consistent.

**Playback highlight**

- Notes/chords sounding at `playbackTick`: additional **2px** inner border `#F59E0B` **or** full-cell tint +15% saturation — choose one pattern for chords and one for notes and document in component readme; default: **amber `#F59E0B` outline** on top of block.

**Playback cursor**

- Vertical line: `PLAYBACK_CURSOR_COLOR`, width `PLAYBACK_CURSOR_WIDTH`; extend through chord + note areas and **measure header** for alignment.

**Scroll / pan**

- Editor scrollbars: **12px** width; thumb `#D1D5DB`, track `#F3F4F6`; on hover thumb `#9CA3AF`.

---

## 7. App layout structure

**Regions**

1. **Top:** toolbar + transport (**48px** total or **48+48** if stacked — prefer single row until space requires split at `xl`).
2. **Center:** editor canvas (flex **1 1 auto**, min-width **0**).
3. **Left:** chord palette / theory tools — default **288px**, collapsible.
4. **Right:** mixer / band / key-scale panels — default **288px**, stack tabs or accordion if multiple; each panel obeys §3 width constraints when resizable.
5. **Optional bottom:** measure strip (`MeasureBar`) — height **56px**, border-top `--color-border`, background `--color-surface`.

**Phased delivery:** Early milestones may ship **without** regions 3–4 when those features are not yet implemented. Reserve `UIStore` / `INTERFACES` panel identifiers and apply §3 dimensions when panels first mount. Do not permanently fork layout token values for “temporary” shells — converge on §7 as features land.

**Panel behavior**

- **Collapsible:** each side panel MAY collapse to **48px** rail; toggle via toolbar button with `aria-expanded`.
- **Resizable:** optional but recommended for mixer/palette; drag handle on panel edge facing editor (§3 dimensions).
- **Z-order:** modals and dropdowns above panels; dropdowns clip to viewport with flip.

**Editor canvas container**

- Background `--color-app-bg` or `#FFFFFF` immediately behind grid — choose **white** `#FFFFFF` for grid area for consistency with Hookpad-like sheet; outer gutter `--color-app-bg`.

---

## 8. Interaction and animation

**Durations**

| Use | Duration | Easing |
| --- | --- | --- |
| Hover color/border | 120ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Panel collapse / width | 200ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Modal enter/exit | 200ms | same |
| Toast enter | 180ms | ease-out |
| Toast exit | 150ms | ease-in |

**Loading**

- **Initial app / route:** centered **spinner** 32px, `primary` stroke, `caption` “Loading…” optional.
- **Piano samples loading** (first play): inline **progress** or spinner in toolbar next to transport; `aria-live="polite"` message when ready.
- **Skeleton:** use for project list rows only (not canvas); **3** rows of **12px** height placeholders, radius **4px**, `--color-surface-muted` animate pulse **1.5s** ease-in-out infinite.

**Autosave (debounced PUT)**

- **Errors** MUST surface via toast (PAT-001); transport retries only where product rules allow (see `PATTERNS.md` / API client).
- **Success** MAY omit a toast to avoid noise. If success is silent, Builders SHOULD still provide a lightweight cue that the milestone “user sees persistence” expectation is met — e.g. optional **caption** or **“Last saved”** timestamp in editor chrome, or success toast on first save after edit session. Purely silent autosave with no chrome is acceptable only if PM confirms.

**Empty states**

- **No projects:** illustration optional; `h3` “No projects yet”, `body` secondary, primary “Create project”.
- **Empty editor:** subtle hint in editor gutter or first-time tooltip — `caption`, `--color-text-muted`.

**Error states (inline)**

- Form fields: §5.2; lists: **banner** full-width `surface-muted`, border destructive left **4px**, padding **12px**.

**Drag affordances**

- Draggable blocks on canvas: cursor **grab**; while dragging **grabbing**.
- Panel resize: **ew-resize**; MIDI drag export (StudioOne): use **copy** cursor + toast “Dragging MIDI…” per feature spec.

---

## 9. Accessibility baseline

**Scope:** All **non-canvas** UI MUST meet **WCAG 2.2 Level AA** for contrast (normal text **4.5:1**, large text **≥18px regular or 14px bold** **3:1**, UI components and graphics **3:1** where applicable).

**Canvas exemption:** The piano-roll/chord grid is a **custom drawing surface** — full semantic DOM/ARIA for each cell is **not** required. Surrounding controls (toolbar, panels, dialogs) remain fully accessible.

**Keyboard**

- All interactive chrome: **Tab** / **Shift+Tab** order follows visual order; **Enter** activates buttons; **Space** toggles checkboxes / pressed buttons where applicable.
- **Escape** closes modals, dropdowns, and transient panels that took focus.
- Editor keyboard shortcuts (playback, undo) documented in help; not duplicated here — must not steal focus from inputs when typing in forms.

**Focus management**

- On modal open: focus moves to **first focusable** control (or close if destructive pattern demands).
- On modal close: focus returns to **trigger element**.
- Toast notifications: **`aria-live="assertive"`** for errors; **`polite`** for success/info.

**Focus visible**

- Ring: **2px solid** `--color-focus-ring`, **offset 2px** (outline-offset), on `:focus-visible` only (suppress for mouse `:focus` where supported).

**Touch targets**

- Minimum **44×44px** clickable area for toolbar and panel controls; icon buttons may show **40px** visual with **44px** hit area via padding.
- **Measure strip (§7 optional bottom):** All interactive controls in this row — including **Add**, **Delete**, and similar secondary buttons — MUST meet the **44×44px** minimum (e.g. `min-h-11`, padding, or an invisible hit-area extension). Do not rely on **32px** compact button height alone for pointer targets in this strip.

**ARIA patterns**

- **Toolbar:** container `role="toolbar"` with `aria-label` e.g. “Transport” / “Editor tools”; grouped items `role="group"` with `aria-label` when needed.
- **Side panels:** `role="complementary"` or region with `aria-label` (“Chord palette”, “Mixer”); toggle `aria-expanded` / `aria-controls` linking to panel id.
- **Modal:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to title id.
- **Toast:** `role="status"` for non-critical; `role="alert"` for critical errors.
- **Canvas:** `role="application"` on the canvas element **optional**; must have **accessible name** via `aria-label` e.g. “Song editor, use arrow keys and shortcuts documented in help” if keyboard interaction is implemented.

---

## 10. Review checklist (for Reviewers)

- [ ] Token colors used for semantic purpose (no ad-hoc hex in components except canvas renderer constants listed in §6).
- [ ] PAT-010 / PAT-012 honored for degree colors and grid metrics.
- [ ] Touch targets ≥ 44px for chrome; focus-visible ring present.
- [ ] Modals trap focus and restore on close.
- [ ] Toasts for API errors per PAT-001; no raw error codes exposed to users.
- [ ] Minimum width messaging below 1024px or layout constrained per §4.

---

*Document version: 1.2 — MILESTONE-F06-DESIGN-REVIEW: §4 editor-route viewport guard, §8 autosave feedback notes; F-05 items (§1 interim tokens, §7 phased panels, §9 measure-strip targets) unchanged.*
