# Milestone design review — F-06 (Phase 3 close + Phase 4.1 on `develop`)

**Directive:** F-06 — Periodic full UX review (Phase 3 milestone close; scope extended to merged Phase 4.1 per Architect/PM)  
**Role:** Designer  
**Branch reviewed:** `develop` (workspace tip at review time; TASK_STATUS referenced `ead7d21` with TASK-4.1 #34; include Phase 3 PRs #25–#32 and Phase 4.1 #34)  
**Out of scope (in-flight, not shipped):** TASK-4.2 / PR #35, TASK-4.3 / PR #36 — piano samples and harmony voicing engine not treated as merged UX.

**Scope:** `client/src` auth, routing, project list, editor shell (save/load, autosave), toasts, transport / `PlaybackStore` init; server only where user-visible copy is centralized (`errorMessages` / API codes).

---

## Summary — shipped UX vs `UX_GUIDELINES.md` & `ROADMAP.md`

### Aligned with `UX_GUIDELINES.md`

| Area | Evidence |
| --- | --- |
| **§1 Tokens** | Auth forms, `ProjectListPage`, `EditorLayout`, `TransportControls`, `ToastHost`, `DeleteProjectDialog` use `var(--color-*, #hex)` with fallbacks matching the token table. |
| **§3 Layout** | Auth cards and project hub: `max-w-[480px]`, `bg` app background; modal `DeleteProjectDialog`: overlay `rgba(17,24,39,0.5)`, width `min(560px, calc(100vw - 32px))`, padding `p-6` (~24px). |
| **§4 Viewport (project list)** | `ProjectListPage.tsx` + `useMinViewport1024.ts`: full-viewport blocking copy below 1024px per §4. |
| **§5.2 / §5.9 Forms** | `LoginForm.tsx`, `RegisterForm.tsx`: `h-10` inputs, `label` typography, `aria-required`, blur validation, `role="alert"` on errors, `getApiErrorMessage` for API failures (PAT-001). |
| **§5.6 Modal (delete)** | `DeleteProjectDialog.tsx`: native `<dialog>`, destructive primary last, cancel secondary, copy for irreversible delete. |
| **§5.7 Toasts** | `ToastHost.tsx`: bottom-right, `min(400px, 100vw-32px)`, `border-l-4` accent, error `role="alert"` / success `role="status"`; `toastStore.ts` durations 6s / 4s. |
| **§5.8 Toolbar / transport (initial)** | `TransportControls.tsx`: `role="toolbar"` `aria-label="Transport"`, `min-h-[48px]`, border-b, grouped play/pause/stop/rewind, tempo number input, initializing spinner + “Loading audio engine…”, inline `getPlaybackInitErrorMessage` for `initErrorCode`. |
| **§5.10 Project list** | Table rows with `min-h-[56px]`, row primary button for open, hover `surface-muted`, delete opens modal (not inline-only). |
| **§6 / §7 Editor** | `EditorLayout.tsx` + `EditorCanvas` / `MeasureBar` (controls): prior Phase 2 canvas/measure strip behavior retained; header `min-h-[48px]`. |
| **§8 Loading** | Project list skeleton: three pulse rows (`h-3` ≈ 12px), 1.5s animation. Editor: “Loading project…” centered while GET. |
| **§9 ARIA (chrome)** | Transport: `aria-pressed` on pause when playing; `aria-live="polite"` for beat display and init messages; playback ready `sr-only` line. |
| **PAT-001 / errors** | `errorMessages.ts`: centralized `ERROR_MESSAGES`, no raw codes in UI; `NETWORK_FAILURE_USER_MESSAGE` for transport failures; autosave retry only on `isApiTransportFailure` in `EditorLayout.tsx`. |
| **Playback copy** | `playbackErrors.ts`: user strings for `AUDIO_CONTEXT_BLOCKED`, `SAMPLE_LOAD_FAILED`, `ENGINE_INIT_FAILED` (init path). |

### Partially aligned or scope notes

| Topic | Status |
| --- | --- |
| **§4 Viewport — editor & auth** | **Partial.** Only `ProjectListPage` uses `useMinViewport1024`. `/editor`, `/login`, `/register` do **not** block &lt;1024px; user can reach a cramped editor. Guidelines updated in F-06 to require extending the guard to editor routes. |
| **§8 Autosave feedback vs ROADMAP Phase 3** | **Partial.** `EditorLayout.tsx`: debounced PUT (1500ms), success toast **only** for manual save (“Saved.”); autosave success is silent. ROADMAP milestone text (“sees it auto-save”) is met operationally (persist + errors) but not by visible success affordance. Optional: last-saved caption or subtle status (product/Builder follow-up). |
| **§8 Empty project list** | **Partial.** Copy is “No projects yet.” with create form above — acceptable; §8 “No projects yet” + primary CTA pattern is weaker than the full empty-state template (no `h3` block). |
| **§1 `@theme` / centralized tokens** | Still `index.css` = `@import 'tailwindcss'` only — interim `var(--token, #fallback)` pattern remains valid per §1. |
| **§7 Side panels** | Still not shipped — unchanged from F-05; phased delivery note in guidelines still applies. |
| **ROADMAP Phase 4 overall** | **4.1 only merged:** Tone/init + transport **chrome** and init lifecycle. Audible piano (4.2), voicing (4.3), scheduler (4.4), cursor (4.6), mixer (4.7), loop (4.8) remain roadmap — not drift, scope boundary. |
| **PR #35 / #36** | In-flight; sample-load UI strings exist in `playbackErrors.ts` for future wiring — no review as shipped UX. |

### Gaps and drift

1. **§9 Touch targets — `MeasureBar` Add/Delete** — Still **`h-8` (32px)** in `components/controls/MeasureBar.tsx` (`secondaryButtonClass` / `destructiveOutlineButtonClass`). §9 requires **≥44×44px** for measure-strip controls (guidelines v1.1). **Open:** Builder fix pass.  
2. **§9 — `EntryModeToggle`** — Still **`h-8`** in `components/editor/EntryModeToggle.tsx`; same touch-target gap as F-05.  
3. **§5.1 Focus affordance — auth primary submit** — `LoginForm` / `RegisterForm` use `focus-visible:outline` on submit; §5.1 specifies **2px ring** pattern for primary. Minor visual drift; align to ring for consistency.  
4. **§5.6 Focus trap** — `DeleteProjectDialog` uses native `<dialog>` (browser handles focus); no explicit `role="dialog"` / `aria-modal` in markup — native dialog is generally acceptable; Reviewer may confirm Escape/backdrop behavior.  
5. **Transport touch targets** — `TransportControls` buttons are **`h-10` (40px)** visual; §9 allows **40px** visual with **44px** hit area via padding — verify invisible extension or accept as dense toolbar with documented exception.  
6. **⛔ `INTERFACES.md`** — Not blocking this review: `TransportControls.tsx` references INTERFACES; Architect already standardized `TransportControlsProps` for TASK-4.1. No new interface change proposed here.

---

## Recommendations (priority)

1. **P0 — Viewport:** Apply `useMinViewport1024` (or shared wrapper) to **`EditorLayout`** and preferably **auth** routes so §4 is consistent app-wide.  
2. **P1 — Touch:** Raise **MeasureBar** Add/Delete and **EntryModeToggle** to meet §9 (e.g. `min-h-11` / padding).  
3. **P2 — Autosave visibility:** Add non-toast “last saved” or subtle status if PM wants strict alignment with “sees it auto-save” as *visible* feedback.  
4. **P3 — Polish:** Align auth submit **focus-visible** with §5.1 ring; optional empty-state upgrade on project list when count is 0.

---

## `UX_GUIDELINES.md` changelog (F-06)

**Version 1.2:** §4 expanded — minimum-width guard required for **editor** routes (not only project list); §8 note on **autosave** success feedback (silent OK; optional visible last-saved). Document footer updated.

---

## Files referenced (evidence)

| Path | Role |
| --- | --- |
| `client/src/app/AppRoutes.tsx` | Routes, `ToastHost`, auth wrappers |
| `client/src/app/EditorLayout.tsx` | Save/load, autosave, transport wiring |
| `client/src/components/auth/LoginForm.tsx` | Auth UX |
| `client/src/components/auth/RegisterForm.tsx` | Auth UX |
| `client/src/components/projects/ProjectListPage.tsx` | List, create, viewport guard |
| `client/src/components/projects/DeleteProjectDialog.tsx` | Destructive confirm |
| `client/src/components/common/ToastHost.tsx` | Toasts |
| `client/src/components/controls/TransportControls.tsx` | Transport §5.8 |
| `client/src/components/controls/MeasureBar.tsx` | Measure strip |
| `client/src/components/editor/EntryModeToggle.tsx` | Entry mode |
| `client/src/hooks/useMinViewport1024.ts` | Viewport matchMedia |
| `client/src/utils/errorMessages.ts` | PAT-001 copy |
| `client/src/engine/audio/playbackErrors.ts` | Playback user strings |
| `client/src/store/toastStore.ts` | Toast durations |

No application code changes in this directive beyond Designer-owned docs.
