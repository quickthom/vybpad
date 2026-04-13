# TASK STATUS ARCHIVE — vYbpad

> Completed-phase detail archived from `TASK_STATUS.md` per PAT-022.

---

## Phase 0 — Foundation (7/7)

| Task | PR/Commit | Summary |
|---|---|---|
| 0.1 Project scaffolding | `301e366` | Monorepo + tooling |
| 0.2 Client scaffold | `574b5cd` | Vite + React shell |
| 0.3 Server scaffold | `2948b72` | Express + Prisma |
| 0.4 Shared types | `af399d7` | `@vybpad/shared` |
| 0.5 Docker Compose | `3598985` | Postgres + dev env |
| 0.6 Prisma schema | `da8d40c` | User + Project models |
| 0.7 UX Guidelines | `5188bce` | `UX_GUIDELINES.md` |

---

## Phase 1A — Music Theory Engine (7/7)

| Task | PR | Commit | Summary |
|---|---|---|---|
| 1A.1 Scale definitions | — | `8e3dd3f` ancestry | Scale/mode data |
| 1A.2 scaleDegreeToMidi | — | — | Degree→MIDI conversion |
| 1A.3 Chord construction | — | — | Chord from degree+quality |
| 1A.4 Roman numeral generation | [#2](https://github.com/quickthom/vybpad/pull/2) | `45f3224` | Roman numeral labels |
| 1A.5 Borrowed + secondary chords | [#3](https://github.com/quickthom/vybpad/pull/3) | `01e95df` | Non-diatonic chord logic |
| 1A.6 Guide tone classification | [#4](https://github.com/quickthom/vybpad/pull/4) | `ad18882` | Chord/scale/chromatic tagging |
| 1A.7 Theory unit tests | [#5](https://github.com/quickthom/vybpad/pull/5) | `8e2a3c0` | theoryEngine facade + contract tests |

---

## Phase 1B — Auth & API Layer (6/6)

| Task | PR | Commit | Summary |
|---|---|---|---|
| 1B.1 Auth routes | — | — | Register/login/refresh |
| 1B.2 Auth middleware | — | — | JWT verification |
| 1B.3 Project CRUD routes | [#1](https://github.com/quickthom/vybpad/pull/1) | `16c96d1` | REST endpoints |
| 1B.4 Default song factory | [#6](https://github.com/quickthom/vybpad/pull/6) | `ffc89af` | 8-measure empty song |
| 1B.5 API client module | — | — | Fetch wrapper |
| 1B.6 API integration tests | [#7](https://github.com/quickthom/vybpad/pull/7) | `a8cf52a` | Server route tests |

---

## Phase 2 — Grid Editor & Song State (15/15)

| Task | PR | Commit | Summary |
|---|---|---|---|
| 2.1 Zustand song store | [#8](https://github.com/quickthom/vybpad/pull/8) | `11bba21` | SongStore + undo/redo |
| 2.2 Canvas layout engine | [#9](https://github.com/quickthom/vybpad/pull/9) | `0b10348` | tick↔px, pitch↔Y |
| 2.3 Grid background | [#10](https://github.com/quickthom/vybpad/pull/10) | `e2dd50e` | Beat/bar lines, measure numbers |
| 2.4 Chord block renderer | [#12](https://github.com/quickthom/vybpad/pull/12) | `5529cac` | Roman labels, PAT-010 fills |
| 2.5 Note block renderer | [#11](https://github.com/quickthom/vybpad/pull/11) | `2839513` | Degree blocks, octave indicators |
| 2.6 Hit testing | [#13](https://github.com/quickthom/vybpad/pull/13) | `1fe2334` | Spatial index for canvas |
| 2.7 Mouse interaction | [#14](https://github.com/quickthom/vybpad/pull/14) | `a0ad185` | Click select, drag move/resize |
| 2.8 Keyboard input | [#16](https://github.com/quickthom/vybpad/pull/16)+[#17](https://github.com/quickthom/vybpad/pull/17) | `a70f2da`+`cb181de` | Degree entry, duration, arrows; digit-key hotfix |
| 2.9 Entry modes | [#18](https://github.com/quickthom/vybpad/pull/18) | `433266f` | Table vs text input |
| 2.10 Measure bar | [#15](https://github.com/quickthom/vybpad/pull/15) | `131f421` | Add/delete measures, selection |
| 2.11 UI store | [#20](https://github.com/quickthom/vybpad/pull/20) | `4529fff` | Viewport, selection, voice, panels |
| 2.12 Guide tone overlay | [#23](https://github.com/quickthom/vybpad/pull/23) | `a0087ca` | Chord compatibility highlighting |
| 2.13 Color scheme | [#22](https://github.com/quickthom/vybpad/pull/22) | `7b70fff` | Diatonic + major-centric PAT-010 |
| 2.14 Canvas renderer tests | [#21](https://github.com/quickthom/vybpad/pull/21) | `7e8e9b5` | Draw-call assertion suite |
| 2.15 Song store tests | [#19](https://github.com/quickthom/vybpad/pull/19) | `0b53846` | Mutation + undo/redo coverage |

**Phase 2 notes:**
- Escalation: TASK-2.9 required `INTERFACES.md` update (`getSongAfterMutation?`, `onToggleEntryMode?` on `EditorCanvasProps`).
- Escalation: TASK-2.11 required `INTERFACES.md` update (`UIStore.toggleEntryMode()`).
- Hotfix: TASK-2.8 digit keys dispatched `add` instead of `update` — caught by Reviewer, fixed in PR #17.
- Non-blocking follow-ups carried to Phase 3 cleanup: hover cursor `grab` dead code in jsdom (2.7); `measuresPerLine=0` infinite loop guard (2.10); theory import facade (1A.7); deeper API test assertions (1B.6); stale `toggleEntryMode` comment in `uiStore.ts`.

---

## Phase 4 session log migration — 2026-04-14

Migrated from `TASK_STATUS.md` (retired per PAT-025 single-section format).

2026-04-13 TASK-4.2 ci-remediation active PR:#35 lane:Builder+QA (E2E 401 console errors; Actions run 24353007958)
2026-04-13 TASK-4.2 ci-failure PR:#35 Actions:24354157756 (E2E strict mode duplicate role=alert; not infra)
2026-04-13 TASK-4.2 remediation-pushed PR:#35 branch:phase-4/piano-sample-loading (single toast alert; E2E Scenario D; commit b3348e7 on worktree — verify on origin CI)
2026-04-13 TASK-4.2 ci-failure PR:#35 Actions:24354792596 (E2E persistence.happy autosave ≥2 chords — app/tests; not infra)
2026-04-13 TASK-4.2 remediation-pushed PR:#35 commits:e9425ff,9af5c18 (persistence E2E + canvas focus) await-next-CI
2026-04-13 TASK-4.2 ci-failure PR:#35 Actions:24355475894 head:9af5c18 (E2E persistence.happy poll ≥2 chords — app/autosave; not infra)
2026-04-13 TASK-4.2 pm-spawn Builder+QA PR:#35 lane:ci-remediation-round-2
2026-04-13 TASK-4.2 remediation-pushed PR:#35 commits:d8e6c84,3bdedd5 (EditorLayout bootstrap; persistence E2E Table mode) CI:24356446158-in-progress
2026-04-13 TASK-4.2 ci-failure PR:#35 Actions:24356446158 head:3bdedd5 (E2E persistence.happy poll ≥2 chords — app/tests; not infra)
2026-04-13 TASK-4.2 ci-failure PR:#35 Actions:24358370117 head:c141228 (same E2E failure after commits through c141228)
2026-04-13 TASK-4.2 pm-brief remediation-r3 PR:#35 lane:Builder+QA persistence E2E
2026-04-13 TASK-4.2 remediation-pushed PR:#35 commits:1565698,57c4f23 (E2E degrees 1+2; POST bootstrap GET dedupe)
2026-04-13 TASK-4.2 ci-failure PR:#35 Actions:24359135236 head:57c4f23 (tsc EditorCanvasProps getSelectionAfterMutation)
2026-04-13 TASK-4.2 remediation-pushed PR:#35 commit:0e150d9 (INTERFACES EditorCanvasProps + doc) CI:24359238228
2026-04-13 TASK-4.2 ci-failure PR:#35 Actions:24359238228 head:0e150d9 (E2E persistence.happy poll scale degrees 1+2 — app/tests)
2026-04-13 TASK-4.2 blocking-flag PR:#35 INTERFACES.md edited commit:0e150d9 — Architect review
2026-04-13 TASK-4.2 pm-brief remediation-r4 PR:#35 lane:Builder+QA persistence E2E
2026-04-13 TASK-4.2 remediation-pushed PR:#35 commits:355c5fe,49b5183,3e73691 (E2E PUT wait strategies)
2026-04-13 TASK-4.2 ci-failure PR:#35 Actions:24359972279 head:355c5fe (GET before PUT completed)
2026-04-13 TASK-4.2 ci-failure PR:#35 Actions:24360173331 head:49b5183 (putReq.response() null)
2026-04-13 TASK-4.2 ci-failure PR:#35 Actions:24360363016 head:3e73691 (waitForResponse 90s no matching PUT body)
