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
