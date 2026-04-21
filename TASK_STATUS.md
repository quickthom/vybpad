# TASK STATUS — vYbpad

> Single source of truth for build state. Owned by the Tech Lead.

---

## Completed Phases

Phases 0 (7/7), 1A (7/7), 1B (6/6), Phase 2 (15/15), Phase 3 (10/10), Phase 4 (11/11), Phase 5 (5.1–5.9 + F-08), Phase 6 (builder + QA tasks merged; 6.6 live StudioOne check HITL), Phase 7 milestone, and Phase 8 — see `TASK_STATUS_ARCHIVE.md` for complete phase/task history.

## UI Remediation — REF_AUDIT_2 (Waves 1–8)

| Task | Role | Branch | Status | PR | Depends | Notes |
|---|---|---|---|---|---|---|
| UI-R2-W1 | Builder | — | merged | — (f1139b1) | None | RA-201/206/208; merged to `develop`. |
| UI-R2-W1 | QA | — | merged | — | UI-R2-W1 | Tests landed with W1. |
| UI-R2-W2 | Builder | — | merged | — (61a9734) | UI-R2-W1 | RA-203/204/207/214; melody transposition matrix + palette affordances. |
| UI-R2-W2 | QA | — | merged | — | UI-R2-W2 | Component tests included in W2 implementation changes. |
| UI-R2-W3 | Builder | — | merged | — (d1840b4) | UI-R2-W2 | RA-202/205; chord inspector + duration control presets/controls. |
| UI-R2-W3 | QA | — | merged | — | UI-R2-W3 | Component tests included in W3 implementation changes. |
| UI-R2-W4.1 | Builder | — | merged | #89 | UI-R2-W1 | Cross-measure remap + live preview. |
| UI-R2-W4.1 | QA | — | merged | #89 | UI-R2-W1 | QA on branch. |
| UI-R2-W4.2 | Builder | — | merged | #90 | UI-R2-W4.1 | OB-8 + OB-13. |
| UI-R2-W4.2 | QA | — | merged | #90 | UI-R2-W4.1 | QA on branch. |
| UI-R2-W4.3 | Builder | — | merged | [#91](https://github.com/quickthom/vybpad/pull/91) | UI-R2-W4.2 | OB-10 undo/redo. |
| UI-R2-W4.3 | QA | — | merged | [#91](https://github.com/quickthom/vybpad/pull/91) | UI-R2-W4.3 | QA on branch. |
| TECH-BASELINE-CI | TaskCoord | — | merged | — | None | **`develop` green:** TL verified `./scripts/ci-local.sh` before W5.1 restart; superseded by ongoing `develop` health. |
| UI-R2-W5.1 | Builder | — | merged | [#94](https://github.com/quickthom/vybpad/pull/94), [#95](https://github.com/quickthom/vybpad/pull/95) | UI-R2-W4.3 | OB-14 slice 1: `voicePitchRange` + tests; #94 squash + #95 ESLint hotfix on `develop` (`63c4841`). |
| UI-R2-W5.1 | QA | — | merged | [#94](https://github.com/quickthom/vybpad/pull/94) | UI-R2-W5.1 | Tests on branch; merged with W5.1. |
| UI-R2-W5.2 | Builder | — | merged | [#96](https://github.com/quickthom/vybpad/pull/96) | UI-R2-W5.1 | OB-14 layout/noteBlocks/hitTest alignment; squash-merge `6b41e7d`. |
| UI-R2-W5.2 | QA | — | merged | [#96](https://github.com/quickthom/vybpad/pull/96) | UI-R2-W5.2 | QA on branch; merged with W5.2. |
| UI-R2-W5.3 | Builder | — | merged | [#97](https://github.com/quickthom/vybpad/pull/97) | UI-R2-W5.2 | OB-15 `measurePacking` + tests; PR opened by TL after coordinator push; squash-merged. |
| UI-R2-W5.3 | QA | — | merged | [#97](https://github.com/quickthom/vybpad/pull/97) | UI-R2-W5.3 | QA/remediation commits on branch. |
| UI-R2-W5.4 | Builder | — | merged | [#98](https://github.com/quickthom/vybpad/pull/98) | UI-R2-W5.3 | OB-15: `EditorLayout` + `computeMeasuresPerLine` → `MeasureBar` chunking; squash-merge `4d200ab`. |
| UI-R2-W5.4 | QA | — | merged | [#98](https://github.com/quickthom/vybpad/pull/98) | UI-R2-W5.4 | Component tests on branch; merged with W5.4. |
| UI-R2-W6.1 | Builder | — | merged | [#99](https://github.com/quickthom/vybpad/pull/99) | UI-R2-W5.4 | OB-16 shell scroll; squash-merge `f5ace87`. |
| UI-R2-W6.1 | QA | — | merged | [#99](https://github.com/quickthom/vybpad/pull/99) | UI-R2-W6.1 | Tests on branch; merged with W6.1. |
| UI-R2-W6.2 | Builder | — | merged | [#100](https://github.com/quickthom/vybpad/pull/100) | UI-R2-W6.1 | OB-11 chord search; squash-merge `b1291df`. |
| UI-R2-W6.2 | QA | — | merged | [#100](https://github.com/quickthom/vybpad/pull/100) | UI-R2-W6.2 | Tests on branch; merged with W6.2. |
| UI-R2-W6.3 | Builder | — | merged | [#101](https://github.com/quickthom/vybpad/pull/101) | UI-R2-W6.2 | OB-12 deterministic Popular shortlist (`getPopularChords`); squash-merge `375733a`. |
| UI-R2-W6.3 | QA | — | merged | [#101](https://github.com/quickthom/vybpad/pull/101) | UI-R2-W6.3 | Tests on branch; merged with W6.3. |
| UI-R2-W7.1 | TaskCoord | — | merged | [#102](https://github.com/quickthom/vybpad/pull/102) | UI-R2-W6.3 | RA-213 left rail width; squash-merge `8d52837`. Reviewer: **approve with warning** — right properties rail `192px` below UX §3 min (240px); documented exception for center-column target. |
| UI-R2-W7.2 | TaskCoord | — | merged | [#103](https://github.com/quickthom/vybpad/pull/103) | UI-R2-W7.1 | RA-210 dual-axis zoom; squash-merge `b44e076`. |
| UI-R2-W7.3 | TaskCoord | — | merged | [#104](https://github.com/quickthom/vybpad/pull/104) | UI-R2-W7.2 | RA-211 mixer overlay. |
| UI-R2-W7.4 | TaskCoord | — | merged | [#105](https://github.com/quickthom/vybpad/pull/105) | UI-R2-W7.3 | RA-212 progressions overlay. |
| UI-R2-W7.5 | TaskCoord | — | pending | — | UI-R2-W7.4 | RA-209 toolbar consolidation — **restarted**: PR [#106](https://github.com/quickthom/vybpad/pull/106) closed; remote branch `phase-ui-r2/w7-5-toolbar-consolidation` deleted; worktrees removed. Fresh branch/PR TBD. |
| UI-R2-W8.1 | TaskCoord | — | pending | — | UI-R2-W7.5 | RA-217 Diatonic Mode vestigial label. |
| UI-R2-W8.2 | TaskCoord | — | pending | — | UI-R2-W8.1 | RA-215 Diatonic/Borrowed controls. |
| UI-R2-W8.3 | TaskCoord | — | pending | — | UI-R2-W8.2 | RA-216 secondary actions. |
| UI-R2-W8.4 | TaskCoord | — | cancelled | — | — | RA-214 optional; **cancelled** — ADD/Split/Tie in `MelodyEntryPanel` (UI-R2-W2). |

---
