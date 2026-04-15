# ARCHITECTURE — vYbpad

> Canonical source of truth for all technical decisions. Only the Tech Lead may modify this file.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Language** | TypeScript (strict mode) | Unified frontend/backend; type safety critical for complex music data model |
| **Frontend framework** | React 18 | Component model suits panel-heavy UI; large ecosystem; concurrent features for responsive editor |
| **Build tool** | Vite 6 | Fast HMR, native TS/ESM support, efficient production builds |
| **Styling** | Tailwind CSS 4 | Utility-first; rapid iteration on UI chrome; consistent spacing/color system |
| **Grid editor rendering** | HTML5 Canvas 2D API (custom) | Performance for dense grid with real-time playback cursor; avoids DOM node explosion of SVG; layered canvas approach (static content + animated overlay) |
| **Audio engine** | Tone.js | Transport scheduling, musical time, PolySynth/Sampler; actively maintained; Web Audio abstraction |
| **Piano samples** | SoundFont via `smplr` | High-quality acoustic piano without large custom sample sets; lazy-loaded at runtime |
| **Music theory** | `tonal` | TypeScript, active maintenance (6.x, 2026), Roman numerals, keys, modes, progressions, scales |
| **MIDI export** | `midi-writer-js` | TypeScript, SMF Type 1, multi-track, text events for chord markers; synergy with `tonal` |
| **State management** | Zustand + Immer | Minimal boilerplate; Immer for immutable updates to complex nested song data; middleware for undo/redo history |
| **Backend runtime** | Node.js 22 LTS | Unified language with frontend; async I/O for API |
| **Backend framework** | Fastify 5 | Low overhead, schema validation, TypeScript-first |
| **Database** | PostgreSQL 16 | JSONB for song data, relational for users/auth; robust, widely hosted |
| **ORM** | Prisma 6 | Type-safe queries, migrations, schema-as-code |
| **Auth** | JWT (access + refresh tokens) | Stateless verification; refresh rotation for security; `bcrypt` for password hashing |
| **Testing** | Vitest + React Testing Library + Playwright | Unit/component/integration/E2E; see Testing Strategy |
| **Containerization** | Docker + Docker Compose | Reproducible dev/prod environments |
| **Deployment** | Docker containers behind HTTPS reverse proxy | Cloud-agnostic; secure context required for Web Audio and Web MIDI |

---

## Project Structure

```
vybpad/
├── client/                     # Frontend SPA
│   ├── src/
│   │   ├── app/               # App shell, providers, routing
│   │   ├── components/
│   │   │   ├── editor/        # Canvas grid editor
│   │   │   ├── controls/      # Transport, toolbar, menus
│   │   │   ├── panels/        # Band config, mixer, key/scale, lyrics
│   │   │   └── common/        # Shared UI primitives
│   │   ├── engine/
│   │   │   ├── theory/        # Music theory (scales, chords, degrees, Roman numerals)
│   │   │   ├── audio/         # Tone.js playback engine
│   │   │   ├── midi/          # MIDI file generation + export
│   │   │   └── renderer/      # Canvas rendering pipeline
│   │   ├── store/             # Zustand stores (song, ui, playback, auth)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── types/             # Frontend-specific types
│   │   └── utils/
│   ├── public/
│   │   └── samples/           # Loaded at runtime, not bundled
│   └── tests/
│       ├── unit/
│       ├── component/
│       └── e2e/               # Playwright specs
├── server/                     # Backend API
│   ├── src/
│   │   ├── routes/            # Fastify route handlers
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Auth, validation, error handling
│   │   └── plugins/           # Fastify plugins
│   └── tests/
├── shared/                     # Shared TypeScript types
│   └── types/                 # Song data model, API contracts
├── prisma/                     # Schema + migrations
├── docker/
├── package.json               # npm workspaces root
├── tsconfig.base.json         # Shared TS config
└── [canonical docs]
```

Monorepo managed via **npm workspaces** with three packages: `@vybpad/client`, `@vybpad/server`, `@vybpad/shared`.

---

## Data Model Overview

### Core Entities

**Song** is the top-level document. Stored as JSONB in PostgreSQL. One song per project row.

```
Song
├── metadata: SongMetadata        (title, initial key, scale, tempo, meter)
├── measures: Measure[]           (ordered; each measure owns its events)
│   ├── chords: ChordEvent[]      (beat-positioned chord blocks)
│   ├── notes: NoteEvent[][]      (indexed by voice 0-3)
│   └── changes?: MeasureChanges  (key, scale, tempo, meter overrides)
├── bandConfig: BandConfig        (track definitions)
└── lyrics?: LyricData            (syllable-to-beat mappings)
```

**Relationships:**
- `User` 1:N `Project` — a user owns many projects
- `Project` 1:1 `Song` — each project contains exactly one song document (JSONB)

### Timing Model

- **Ticks per quarter note (TPQN):** 48
- All beat positions and durations expressed in ticks (integers)
- Quarter note = 48 ticks, eighth = 24, sixteenth = 12, triplet eighth = 16, triplet quarter = 32
- Measure length in ticks = (numerator / denominator) × 4 × TPQN. Example: 4/4 = 192 ticks, 3/4 = 144 ticks, 6/8 = 144 ticks.
- For MIDI export, multiply by 10 → 480 PPQN (standard MIDI resolution)

### Scale Degree Model

Chords and melody notes are stored as **scale degrees** (1–7) relative to the current key and scale. This is Hookpad's core design choice and ours:

- **Transposition is free:** changing key transposes everything automatically
- **Mode changes preserve function:** a IV chord stays a IV chord
- **Chromatic alterations** stored as semitone offsets from the diatonic pitch
- **Conversion to absolute pitch** (MIDI note number) happens at render/playback time using: `tonic_midi + scale_intervals[degree - 1] + (octave * 12) + chromatic_offset`

### Chord Representation

Each chord stores: root scale degree (1–7), quality modifiers, inversion (0–3), embellishments (7th type, sus, add), borrowed mode (if from parallel mode), and secondary target (if applied chord — V/x, vii°/x, IV/x). Full type definition in INTERFACES.md.

### Supported Scales/Modes

Major (Ionian), Minor (Aeolian), Dorian, Phrygian, Lydian, Mixolydian, Locrian, Harmonic Minor, Phrygian Dominant. Stored as interval arrays from tonic.

---

## Canvas Editor Architecture

The grid editor currently uses a **single-canvas layered draw order** (all visual layers painted in one pass):

| Layer order (bottom -> top) | Content | Redraw trigger |
|---|---|---|
| 1 | Grid background (measure/beat guides) | edit, scroll, zoom, resize |
| 2 | Chord blocks | edit, scroll, zoom, resize |
| 3 | Note blocks | edit, scroll, zoom, resize |
| 4 | Guide overlay (optional) | edit, scroll, zoom, resize, showGuides toggle |
| 5 | Interaction overlays | hover/selection highlights, drag feedback, playback cursor |

**Rendering pipeline:**
1. **Viewport** defines visible measure range and vertical scroll offset
2. **Layout engine** computes pixel positions from tick positions + viewport
3. **Canvas renderer** paints deterministic layer order: grid -> chords -> notes -> optional guide overlay -> interaction overlays

**Hit testing:** Computed geometry in renderer helpers and hit-test functions (rect math by visible measure/event); no Canvas `isPointInPath`.

**Coordinate spaces:**
- **Tick space:** horizontal position in musical time
- **Pitch space:** vertical position (scale degree + octave)
- **Pixel space:** screen coordinates after viewport transform

---

## Audio Engine Architecture

Built on **Tone.js Transport** for tempo-synced scheduling.

**Playback pipeline:**
1. Song state → **Scheduler** converts scale-degree events to absolute MIDI pitches using current key/scale context per measure
2. Scheduler creates `Tone.Part` instances for each active track (melody voices, harmony, bass)
3. **Harmony track** generates chord voicings from ChordEvent data using close voicing algorithm centered on configured octave
4. **Piano sampler** (`Tone.Sampler` backed by `smplr` SoundFont samples) renders all tracks for this release (extensible to multi-instrument later)
5. Transport emits position callbacks → overlay canvas renders playback cursor

**Sample loading:** Piano samples loaded lazily on first play. Loading state shown in UI. Samples cached in browser via Cache API.

**Voicing engine** (harmony track): Given a chord (root + quality + inversion), produces 3–4 note voicings. Root-position close voicing is default. Inversions rotate the bottom note up. Voice leading between consecutive chords minimizes total pitch movement.

---

## Auth Strategy

| Aspect | Decision |
|---|---|
| Mechanism | JWT with short-lived access token + long-lived refresh token |
| Access token lifetime | 15 minutes |
| Refresh token lifetime | 7 days, rotated on each refresh |
| Password storage | `bcrypt` with cost factor 12 |
| Token storage (client) | Access token in memory (Zustand); refresh token in `httpOnly` secure cookie |
| Session handling | Stateless JWT verification on API; refresh token family tracking in DB for revocation |
| Scope | All API endpoints except `POST /api/auth/login` and `POST /api/auth/register` require valid access token |

Auth is infrastructure, not a feature surface. Login/register are minimal UI. No account management, password reset, or social login in this release.

---

## Infrastructure Overview

| Environment | Setup |
|---|---|
| **Source control** | GitHub: `https://github.com/quickthom/vybpad` — default branch `develop`; open PRs against `develop` |
| **Development** | Docker Compose: PostgreSQL + API server (hot reload) + Vite dev server |
| **Production** | Docker containers: Nginx (static SPA + reverse proxy to API) + Node.js API + PostgreSQL |
| **HTTPS** | Required. Web Audio API and Web MIDI API require secure context. TLS terminated at reverse proxy. |
| **Static assets** | SPA bundle served by Nginx. Piano samples served from `/samples/` path, cached aggressively. |
| **Database backups** | PostgreSQL `pg_dump` on schedule (provider-dependent) |

No CDN, S3, or separate file storage required for MVP. Audio exports (MIDI, future MP3) are generated client-side and downloaded directly.

---

## StudioOne Integration

**Export approach:** MIDI Type 1 file with multiple tracks:
1. **Melody track** — note events with correct MIDI pitches, velocities, durations
2. **Chord track** — chord root notes + MIDI Text Events (FF 01) naming each chord (e.g., "Cmaj7", "Dm")
3. **Tempo track** — tempo map matching the song

StudioOne imports MIDI Type 1 and displays text events as markers. Users drag the `.mid` file into StudioOne. The chord track provides enough information for StudioOne's chord analysis to populate its Chord Track.

**Drag-and-drop export:** The app will support generating a MIDI blob and initiating a browser drag event, allowing users to drag directly from the app into StudioOne (or any DAW) without a file save dialog. Fallback: standard file download.

> **Open question (low confidence):** Whether StudioOne auto-populates its Chord Track from MIDI text events needs validation during implementation. If not, we may need to encode chords as actual note data on a separate track for StudioOne to analyze. Flag to HITL if this path fails.

---

## Key Constraints

### Decided
- **Scale-degree-first data model.** All pitch data stored as scale degrees, converted to absolute pitch at render/playback time. This is non-negotiable — it's the core of the Hookpad model.
- **Canvas for editor, React for everything else.** The grid editor is custom Canvas. All panels, toolbars, dialogs, and controls are React components.
- **Single instrument for this release.** Piano only for all playback tracks (harmony, melody, bass). Band/instrument system is designed extensibly but not built out.
- **Client-side export.** MIDI, and future MP3/PDF, generated in the browser. No server-side rendering pipeline.
- **48 TPQN internal timing.** All durations and positions in ticks. MIDI export scales to 480 PPQN.
- **Client-only editor preferences.** Phase 7 settings such as entry mode, labels, colors, guides, and staff spacing persist in browser-local state only; no server preferences API in this release.

### Out of Scope
- Full band/arrangement system (beyond default piano)
- AI features (Aria equivalent)
- TheoryTab library / clip search
- Account management UI (password reset, profile, settings)
- Social login / OAuth
- YouTube sync
- Audio file import/sync
- MIDI controller input (Web MIDI for input)
- PDF score export (may be added later; requires a notation rendering engine like LilyPond or VexFlow)
- MP3/WAV export (may be added later via `OfflineAudioContext`)
- Lyrics (partial — architecture supports it but not in MVP scope unless time permits)

### HITL Notifications
These features exist in Hookpad but are **excluded or deferred** per the requirements exceptions and feasibility assessment:
1. **Full band/arrangement system** — per requirements exception, default piano backing is sufficient
2. **AI features (Aria)** — per requirements exception, ignored entirely
3. **StudioOne Chord Track auto-population** — feasibility uncertain; MIDI text events are the best available approach without a VST plugin
4. **PDF score export** — requires notation rendering (LilyPond/VexFlow); deferred to post-MVP
5. **Neapolitan (N6) and augmented sixth chords** — not natively supported in Hookpad's UI per research; these are forum feature requests, not documented features. Excluded.

---

## Testing Strategy

| Layer | Tool | What gets tested |
|---|---|---|
| **Music theory engine** | Vitest | Scale intervals, chord construction, Roman numeral generation, scale-degree-to-MIDI conversion, key transposition, borrowed/secondary chord logic |
| **State management** | Vitest | Zustand stores: song mutations, undo/redo, selection, clipboard |
| **Audio scheduling** | Vitest + mocked Tone.js | Correct note scheduling, chord voicing output, transport sync |
| **Canvas renderer** | Vitest + mock Canvas context | Correct draw calls for notes, chords, grid; playback highlight positions |
| **React components** | Vitest + React Testing Library | Toolbar state, panel interactions, transport controls, chord palette selection, keyboard shortcut dispatch |
| **DOM/UI integration** | Vitest + RTL | Verify DOM elements reflect state: note highlighting, chord display, meter/key indicators |
| **User flows (E2E)** | Playwright | Enter chords → enter melody → play back → verify cursor movement → export MIDI → verify file |
| **Accessibility** | Playwright + axe-core | Keyboard navigation, ARIA labels for non-canvas controls |

**E2E harness (local):** Playwright must not start tests until **both** the API (`GET /api/health`) and the Vite dev server respond. Tests are executed locally; GitHub Actions is disabled. See `docs/CI_LOCAL.md` for the required pre-review sequence.

**Canvas testing detail:** Since Canvas doesn't produce DOM nodes, we test by:
1. Mocking `CanvasRenderingContext2D` and asserting draw calls (fillRect position/color for note blocks, fillText for chord labels)
2. Testing the data pipeline separately: given song state X and viewport Y, assert the renderer produces draw commands Z
3. E2E visual regression via Playwright screenshots for critical editor states

**Playback highlight testing:** The playback engine emits tick-position events. We test that:
1. The store updates `currentPlaybackTick` correctly over time (mocked Tone.Transport)
2. The renderer, given a `currentPlaybackTick`, highlights the correct notes and chord (verified via mock canvas assertions)
3. E2E: Playwright starts playback and asserts playback-state progression and transport-visible behavior; cursor visuals are canvas-rendered (no separate DOM cursor element)
