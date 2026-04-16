# TASK STATUS — vYbpad

> Single source of truth for build state. Owned by the Tech Lead.

---

## Completed Phases

Phases 0 (7/7), 1A (7/7), 1B (6/6), Phase 2 (15/15), Phase 3 (10/10), Phase 4 (11/11), Phase 5 (5.1–5.9 + F-08), **Phase 6 (builder + QA tasks merged; 6.6 live StudioOne check HITL)** — see `TASK_STATUS_ARCHIVE.md`

**Phase 7 (TASK-7.1–7.10 milestone)** — archived 2026-04-15 — see `TASK_STATUS_ARCHIVE.md` (**optional TASK-7.0** backlog rolled into **TASK-8.0** Phase-start cleanup)

---

## Phase 8 — Final QA & Deployment

**Status:** TASK-8.5–8.8 executed on `develop` (2026-04-16); **8.9** is HITL walkthrough only. TASK-6.6 StudioOne remains **HITL manual** (coverage matrix).

| Task | Role | Branch | Status | PR | Depends | Notes |
|---|---|---|---|---|---|---|
| 8.0 | Builder | — | merged | [#75](https://github.com/quickthom/vybpad/pull/75) | None | Phase-start cleanup (MeasureBar stride, TransportControls JSDoc, TASK-8.0 tests, editor UI settings test spy); TASK-7.0 backlog addressed |
| 8.0 | QA | — | merged | #75 | None | Tests on branch with Builder (#75) |
| F10-12–15 | Builder | — | merged | [#73](https://github.com/quickthom/vybpad/pull/73) | None | Items 12–15: MIDI ARIA, Tooltip, ChordPalette width, lg chrome |
| F10-12–15 | QA | — | merged | #73 | — | Concurrent tests landed with implementation |
| F10-16 | Tech Lead | — | merged | [#74](https://github.com/quickthom/vybpad/pull/74) | — | `docs/E2E_EDITOR.md` + `docs/CI_LOCAL.md` link |
| 8.1 | QA | — | merged | [#77](https://github.com/quickthom/vybpad/pull/77) | None | `docs/TEST_COVERAGE_MATRIX.md`; **TASK-6.6** HITL row |
| 8.2 | QA | — | merged | [#78](https://github.com/quickthom/vybpad/pull/78) | None | Full workflow E2E + MIDI export/header |
| 8.3 + 8.4 | QA | — | merged | [#79](https://github.com/quickthom/vybpad/pull/79) | None | axe chrome + `editor-shell.task-8-4` visual baselines |
| 8.x | Tech Lead | — | merged | [#80](https://github.com/quickthom/vybpad/pull/80) | None | Optional `npm run test:coverage` (report-only); merged to `develop` |
| 8.5 + 8.6 | Tech Lead | — | merged | — (a67453a) | 8.0–8.4 | `docker-compose.prod.yml`, prod Dockerfiles, Nginx, Prisma `migrate deploy`, `docs/PRODUCTION.md`, `docs/HTTPS.md` |
| 8.7 | Builder | — | merged | [#81](https://github.com/quickthom/vybpad/pull/81) | 8.5 | Vite `manualChunks` + lazy route bundles (`AppRoutes.tsx`) |
| 8.8 | Tech Lead | — | merged | — | 8.5–8.7 | `docker compose` smoke; HTTPS smoke via tunnel URL (ephemeral — rebuild client with `PUBLIC_ORIGIN` for any new public hostname) |

---

## UI Remediation — REF_AUDIT_1 (Waves 1–9)

> Sequencing: [ui_remediation_sequencing_ec8db0c2.plan.md](ui_remediation_sequencing_ec8db0c2.plan.md); Waves 2–3: [docs/audit/UI_REMEDIATION_WAVES_2_3.md](docs/audit/UI_REMEDIATION_WAVES_2_3.md); Waves 4–6: [docs/audit/UI_REMEDIATION_WAVES_4_6.md](docs/audit/UI_REMEDIATION_WAVES_4_6.md); Waves 7–9: [docs/audit/UI_REMEDIATION_WAVES_7_9.md](docs/audit/UI_REMEDIATION_WAVES_7_9.md).

| Task | Role | Branch | Status | PR | Depends | Notes |
|---|---|---|---|---|---|---|
| UI-W1 | Builder | — | merged | — (local merge) | None | RA-1 + RA-3 piano roll + horizontal note bars; branch `phase-8/ui-remediation-wave1` @521e415; push/PR pending HITL credentials |
| UI-W1 | QA | — | merged | — | None | Tests landed with UI-W1 |
| UI-W2 | Builder | — | merged | — (local merge) | UI-W1 | RA-2 bottom chord strip; branch `phase-8/ui-remediation-wave2` @1a92b3d + ARCHITECTURE sync 015253d |
| UI-W2 | QA | — | merged | — | UI-W1 | chordStrip.ui-w2 tests |
| UI-W3 | Builder | — | merged | — (local merge) | UI-W2 | RA-5 + RA-6; branch `phase-8/ui-remediation-wave3` @5fdd283 + INTERFACES `melodyChromaticEntryActive` |
| UI-W3 | QA | — | merged | — | UI-W2 | Component tests + chromatic remediation |
| UI-W4 | Builder | — | merged | — (local f6d4cf9) | UI-W3 | RA-4 right properties; artifact `docs/pull-requests/UI-W4.md`; `phase-8/ui-right-properties` merged to develop |
| UI-W4 | QA | — | merged | — | UI-W3 | Pre-written tests landed with UI-W4 |
| UI-W5 | Builder | — | merged | — (local 43721fe) | UI-W4 | RA-7 + RA-8; `docs/pull-requests/UI-W5.md`; `phase-8/ui-voices-discovery` merged to develop |
| UI-W5 | QA | — | merged | — | UI-W4 | Tests with UI-W5 |
| UI-W6 | Builder | — | merged | — (local 2f40e28 + INTERFACES dd97eb3) | UI-W5 | RA-9/11/18 + RA-15 stubs; `docs/pull-requests/UI-W6.md`; `phase-8/ui-shell-consolidation` merged to develop |
| UI-W6 | QA | — | merged | — | UI-W5 | Playwright `ui-shell-consolidation.ui-w6.spec.ts` |
| UI-W7 | Builder | — | merged | — (local 6b2fd46) | UI-W6 | RA-10 + RA-12; `docs/pull-requests/UI-W7.md` |
| UI-W7 | QA | — | merged | — | UI-W6 | `ChordPalette.EditorLayout.ui-w7.ra10-ra12.test.tsx` |
| UI-W8 | Builder | — | merged | — (local 9b0ba8c) | UI-W7 | RA-13–16,20–21; `docs/pull-requests/UI-W8.md` |
| UI-W8 | QA | — | merged | — | UI-W7 | Transport + playbackStore tests |
| UI-W9 | Builder | — | merged | — (local b424761 + INTERFACES 907cac6) | UI-W8 | RA-17 + RA-19; `docs/pull-requests/UI-W9.md` |
| UI-W9 | QA | — | merged | — | UI-W8 | `ChordPalette.EditorLayout.ui-w9.ra17-ra19.test.tsx` |

---

## Operator backlog — OB-1 … OB-6

> Source: [docs/audit/UI_REMEDIATION_OPERATOR_BACKLOG.md](docs/audit/UI_REMEDIATION_OPERATOR_BACKLOG.md); sequencing: operator plan `ob_backlog_sequencing_75df398e.plan.md` (Cursor plans dir).

| Task | Role | Branch | Status | PR | Depends | Notes |
|---|---|---|---|---|---|---|
| OB-4 | Builder | — | merged | [#82](https://github.com/quickthom/vybpad/pull/82) | None | P0 viewport drag — squash-merged to `develop` |
| OB-4 | QA | — | merged | [#82](https://github.com/quickthom/vybpad/pull/82) | None | E2E + unit tests in #82 |
| OB-3 | Builder | — | pending | — | OB-4 | Resize notes by dragging edges (P1) |
| OB-3 | QA | — | pending | — | OB-4 | — |
| OB-5 | Builder | — | pending | — | OB-3 | Magnetic snap to beats / fractions (P2) |
| OB-5 | QA | — | pending | — | OB-3 | — |
| OB-1+2 | Builder | — | pending | — | OB-4 | Note + chord click audition; PAT-026 (combined per TL sequencing) |
| OB-1+2 | QA | — | pending | — | OB-4 | — |
| OB-6 | Builder | — | pending | — | OB-1+2 | Global UI density / windowed comfort (P2); UX_GUIDELINES if tokens change |
| OB-6 | QA | — | pending | — | OB-1+2 | — |

---
