# INTERFACES — vYbpad

> All shared API contracts, component prop signatures, data schemas, and inter-service boundaries. Only the Architect may modify this file.

---

## API Versioning

All endpoints prefixed with `/api`. No URL-based versioning for MVP. If breaking changes become necessary post-launch, introduce `/api/v2` alongside `/api` (which remains v1).

---

## Shared Error Shapes

All error responses conform to one of these shapes:

```typescript
interface ValidationError {
  code: "VALIDATION_ERROR";
  fields: Record<string, string>;      // field name → error message
}

interface ConflictError {
  code: "EMAIL_ALREADY_EXISTS";
}

interface AuthError {
  code: "INVALID_CREDENTIALS" | "INVALID_REFRESH_TOKEN" | "TOKEN_EXPIRED" | "UNAUTHORIZED";
}

interface NotFoundError {
  code: "NOT_FOUND";
  resource: string;                    // e.g., "project"
}

interface ServerError {
  code: "INTERNAL_ERROR";
  message?: string;                    // only in development
}
```

All errors include HTTP status code via header. Body always has `code` as discriminant.

---

## Auth Endpoints

### POST /api/auth/register
Auth: none

```typescript
// Request
interface RegisterRequest {
  email: string;                       // valid email format, max 255 chars
  password: string;                    // min 8 chars, max 128 chars
  displayName: string;                 // 1–50 chars, trimmed
}

// Response 201
interface AuthResponse {
  user: UserResponse;
  accessToken: string;                 // JWT, 15 min expiry
}
// + Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800

// Response 400: ValidationError
// Response 409: ConflictError { code: "EMAIL_ALREADY_EXISTS" }
```

### POST /api/auth/login
Auth: none

```typescript
// Request
interface LoginRequest {
  email: string;
  password: string;
}

// Response 200: AuthResponse (same shape as register)
// + Set-Cookie: refreshToken
// Response 401: AuthError { code: "INVALID_CREDENTIALS" }
```

### POST /api/auth/refresh
Auth: none (refresh token read from `httpOnly` cookie)

```typescript
// Request: empty body

// Response 200
interface RefreshResponse {
  accessToken: string;
}
// + Set-Cookie: new refreshToken (old one is revoked)

// Response 401: AuthError { code: "INVALID_REFRESH_TOKEN" }
```

### POST /api/auth/logout
Auth: Bearer token required

```typescript
// Request: empty body
// Response 204 (no body)
// Revokes all refresh tokens for the token family
// Clears refreshToken cookie
```

---

## User Types

```typescript
interface UserResponse {
  id: string;                          // UUID
  email: string;
  displayName: string;
  createdAt: string;                   // ISO 8601
}
```

---

## Project Endpoints

All project endpoints require `Authorization: Bearer <accessToken>`. Users can only access their own projects.

### GET /api/projects
List projects for the authenticated user. Returns summaries (no song data).

```typescript
// Response 200
interface ProjectListResponse {
  projects: ProjectSummary[];
}

interface ProjectSummary {
  id: string;                          // UUID
  name: string;
  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
}
```

### POST /api/projects
Create a new project.

```typescript
// Request
interface CreateProjectRequest {
  name: string;                        // 1–100 chars, trimmed
  songData?: SongData;                 // if omitted, server creates default empty song
}

// Response 201
interface ProjectResponse {
  id: string;                          // UUID
  name: string;
  songData: SongData;
  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
}

// Response 400: ValidationError
```

### GET /api/projects/:id

```typescript
// Response 200: ProjectResponse
// Response 404: NotFoundError { code: "NOT_FOUND", resource: "project" }
```

### PUT /api/projects/:id
Partial update. Only provided fields are updated.

```typescript
// Request
interface UpdateProjectRequest {
  name?: string;                       // 1–100 chars if provided
  songData?: SongData;                 // full replacement if provided
}

// Response 200: ProjectResponse
// Response 400: ValidationError
// Response 404: NotFoundError
```

### DELETE /api/projects/:id

```typescript
// Response 204 (no body)
// Response 404: NotFoundError
```

---

## Database Schema

### users

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| id | UUID | no | `gen_random_uuid()` | PK |
| email | VARCHAR(255) | no | — | UNIQUE, indexed |
| display_name | VARCHAR(50) | no | — | |
| password_hash | VARCHAR(255) | no | — | bcrypt hash |
| created_at | TIMESTAMPTZ | no | `now()` | |
| updated_at | TIMESTAMPTZ | no | `now()` | auto-updated |

### projects

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| id | UUID | no | `gen_random_uuid()` | PK |
| user_id | UUID | no | — | FK → users.id, ON DELETE CASCADE, indexed |
| name | VARCHAR(100) | no | — | |
| song_data | JSONB | no | — | contains full SongData document |
| created_at | TIMESTAMPTZ | no | `now()` | |
| updated_at | TIMESTAMPTZ | no | `now()` | auto-updated |

### refresh_tokens

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| id | UUID | no | `gen_random_uuid()` | PK |
| user_id | UUID | no | — | FK → users.id, ON DELETE CASCADE, indexed |
| token_hash | VARCHAR(255) | no | — | bcrypt hash of the token |
| family_id | UUID | no | — | groups tokens for rotation; indexed |
| expires_at | TIMESTAMPTZ | no | — | |
| revoked_at | TIMESTAMPTZ | yes | NULL | non-null = revoked |
| created_at | TIMESTAMPTZ | no | `now()` | |

**Index:** `refresh_tokens(family_id, revoked_at)` for efficient family-based revocation check.

---

## Song Data Model (TypeScript)

All types below live in `@vybpad/shared`. Used by both client and server.

### Music Theory Primitives

```typescript
type NoteName =
  | "C" | "C#" | "D" | "D#" | "E" | "F"
  | "F#" | "G" | "G#" | "A" | "A#" | "B";

type ScaleType =
  | "major"
  | "minor"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "locrian"
  | "harmonicMinor"
  | "phrygianDominant";

type ScaleDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface TimeSignature {
  numerator: number;                   // e.g., 4, 3, 6, 12
  denominator: number;                 // e.g., 4, 8
}
```

### Chord Types

```typescript
type ChordQuality = "major" | "minor" | "diminished" | "augmented";

type SeventhType = "none" | "maj7" | "min7" | "dom7" | "dim7" | "min7b5";

type SuspensionType = "none" | "sus2" | "sus4";

type AdditionType = "none" | "add9" | "add11" | "add13";

type SecondaryFunction = "V" | "viio" | "IV";

interface SecondaryChord {
  function: SecondaryFunction;         // V/x, viio/x, IV/x
  target: ScaleDegree;                 // the x
}

interface ChordEvent {
  id: string;                          // UUID — stable across undo/redo for selection tracking
  scaleDegree: ScaleDegree;            // root scale degree in current key (1–7)
  quality: ChordQuality;               // explicitly stored, not inferred (set to diatonic default on creation)
  seventh: SeventhType;
  suspension: SuspensionType;
  addition: AdditionType;
  inversion: 0 | 1 | 2 | 3;          // 0=root, 1–3=inversions (3 only valid for 7th chords)
  borrowed: ScaleType | null;          // non-null → chord borrowed from this parallel mode
  secondary: SecondaryChord | null;    // non-null → applied/secondary chord
  beat: number;                        // tick offset from measure start (0-based, integer)
  duration: number;                    // length in ticks (integer, > 0)
}
```

### Note Types

```typescript
interface NoteEvent {
  id: string;                          // UUID
  scaleDegree: ScaleDegree;            // 1–7
  octave: number;                      // relative octave offset from default range (integer, typically -2 to +2)
  chromatic: number;                   // semitone offset from diatonic pitch (integer, typically -1, 0, or +1)
  beat: number;                        // tick offset from measure start (0-based, integer)
  duration: number;                    // length in ticks (integer, > 0)
  isRest: boolean;                     // true → rest; scaleDegree/octave/chromatic ignored
  velocity: number;                    // 1–127 (default 100)
}
```

### Measure & Song Structure

```typescript
interface MeasureChanges {
  key?: NoteName;                      // key change at start of this measure
  scale?: ScaleType;                   // scale/mode change
  tempo?: number;                      // BPM (positive integer, 20–300)
  meter?: TimeSignature;               // time signature change
}

interface Measure {
  id: string;                          // UUID
  chords: ChordEvent[];                // sorted by beat ascending
  notes: [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]];
                                       // voices 0–3; each sorted by beat ascending
  changes?: MeasureChanges;            // undefined → inherits from previous measure (or song metadata for measure 0)
}

interface SongMetadata {
  title: string;                       // 0–200 chars
  key: NoteName;                       // initial tonic
  scale: ScaleType;                    // initial scale/mode
  tempo: number;                       // initial BPM (20–300)
  meter: TimeSignature;                // initial time signature
}

interface SongData {
  version: "1.0";                      // schema version for future migration
  metadata: SongMetadata;
  measures: Measure[];                 // ordered; index = measure number
  bandConfig: BandConfig;
}
```

### Band Configuration

```typescript
type TrackRole =
  | "melody1" | "melody2" | "melody3" | "melody4"
  | "harmony" | "bass" | "drums";

interface Track {
  role: TrackRole;
  instrument: string;                  // instrument identifier (MVP: always "piano")
  volume: number;                      // 0.0–1.0 (clamped)
  mute: boolean;
  octave: number;                      // voicing center offset in octaves (integer, -2 to +2)
}

interface BandConfig {
  tracks: Track[];                     // one per TrackRole; order matches TrackRole enum order
}
```

### Default Song Factory

When a project is created without `songData`, the server generates:

```typescript
const DEFAULT_SONG: SongData = {
  version: "1.0",
  metadata: {
    title: "Untitled",
    key: "C",
    scale: "major",
    tempo: 120,
    meter: { numerator: 4, denominator: 4 },
  },
  measures: [
    { id: "<uuid>", chords: [], notes: [[], [], [], []], changes: undefined },
    { id: "<uuid>", chords: [], notes: [[], [], [], []], changes: undefined },
    { id: "<uuid>", chords: [], notes: [[], [], [], []], changes: undefined },
    { id: "<uuid>", chords: [], notes: [[], [], [], []], changes: undefined },
    { id: "<uuid>", chords: [], notes: [[], [], [], []], changes: undefined },
    { id: "<uuid>", chords: [], notes: [[], [], [], []], changes: undefined },
    { id: "<uuid>", chords: [], notes: [[], [], [], []], changes: undefined },
    { id: "<uuid>", chords: [], notes: [[], [], [], []], changes: undefined },
  ],
  bandConfig: {
    tracks: [
      { role: "melody1", instrument: "piano", volume: 0.8, mute: false, octave: 0 },
      { role: "melody2", instrument: "piano", volume: 0.6, mute: true, octave: 0 },
      { role: "melody3", instrument: "piano", volume: 0.6, mute: true, octave: 0 },
      { role: "melody4", instrument: "piano", volume: 0.6, mute: true, octave: 0 },
      { role: "harmony", instrument: "piano", volume: 0.5, mute: false, octave: 0 },
      { role: "bass", instrument: "piano", volume: 0.5, mute: false, octave: -1 },
      { role: "drums", instrument: "piano", volume: 0.0, mute: true, octave: 0 },
    ],
  },
};
```

---

## Frontend Component Props (Key Shared Interfaces)

These define the contracts between major component boundaries. Internal component props are not listed here.

### EditorCanvas

```typescript
interface EditorCanvasProps {
  song: SongData;
  viewport: Viewport;
  selection: Selection | null;
  playbackTick: number | null;         // null when stopped; absolute tick from song start
  activeVoice: 0 | 1 | 2 | 3;
  entryMode: "table" | "text";
  showGuides: boolean;                 // chord compatibility guide tones
  colorScheme: "diatonic" | "major";
  onChordEdit: (measureIndex: number, event: ChordEditAction) => void;
  onNoteEdit: (measureIndex: number, voice: number, event: NoteEditAction) => void;
  onSelectionChange: (selection: Selection | null) => void;
  onViewportChange: (viewport: Viewport) => void;
  getSongAfterMutation?: () => SongData;  // post-mutation store snapshot for keyboard auto-advance; optional escape hatch for React render-cycle staleness
  getSelectionAfterMutation?: () => Selection | null;  // post-mutation selection snapshot; same timing contract as getSongAfterMutation
  onToggleEntryMode?: () => void;          // callback for Tab key to signal mode switch to parent; paired with entryMode prop
}

interface Viewport {
  startMeasure: number;                // first visible measure index
  measureCount: number;                // how many measures visible
  scrollY: number;                     // vertical scroll offset (for pitch range)
  zoom: number;                        // horizontal zoom level (1.0 = default)
}

interface Selection {
  type: "chord" | "note" | "range";
  measureIndex: number;
  eventIds?: string[];                 // selected chord or note IDs
  rangeStart?: number;                 // tick position for range selection
  rangeEnd?: number;
}
```

### Edit Actions (dispatched from editor to store)

```typescript
type ChordEditAction =
  | { type: "add"; chord: Omit<ChordEvent, "id"> }
  | { type: "delete"; chordId: string }
  | { type: "move"; chordId: string; newBeat: number }
  | { type: "resize"; chordId: string; newDuration: number }
  | { type: "update"; chordId: string; changes: Partial<ChordEvent> };

type NoteEditAction =
  | { type: "add"; note: Omit<NoteEvent, "id"> }
  | { type: "delete"; noteId: string }
  | { type: "move"; noteId: string; newBeat: number; newScaleDegree?: ScaleDegree; newOctave?: number }
  | { type: "resize"; noteId: string; newDuration: number }
  | { type: "update"; noteId: string; changes: Partial<NoteEvent> };
```

### TransportControls

```typescript
interface TransportControlsProps {
  isPlaying: boolean;
  tempo: number;
  currentBeat: string;                 // formatted display: "M:B" (measure:beat)
  initStatus: PlaybackInitStatus;      // audio unlock lifecycle state
  initErrorCode: PlaybackInitErrorCode | null;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRewind: () => void;
  onTempoChange: (bpm: number) => void;
}
```

### ChordPalette

```typescript
interface ChordPaletteProps {
  currentKey: NoteName;
  currentScale: ScaleType;
  onChordSelect: (chord: Omit<ChordEvent, "id" | "beat" | "duration">) => void;
  mode: "diatonic" | "borrowed" | "secondary" | "search";
}
```

### KeyScaleSelector

```typescript
interface KeyScaleSelectorProps {
  currentKey: NoteName;
  currentScale: ScaleType;
  onKeyChange: (key: NoteName, transposition: "parallel" | "relative") => void;
  onScaleChange: (scale: ScaleType, transposition: "parallel" | "relative") => void;
}
```

### MeasureBar

```typescript
interface MeasureBarProps {
  measureCount: number;
  selectedMeasures: [number, number] | null;  // [start, end] inclusive
  measuresPerLine: number;
  onSelectMeasure: (index: number) => void;
  onSelectRange: (start: number, end: number) => void;
  onAddMeasures: (count: number) => void;
  onDeleteMeasures: (start: number, end: number) => void;
}
```

### MixerPanel

```typescript
interface MixerPanelProps {
  bandConfig: BandConfig;
  onTrackChange: (role: TrackRole, changes: Partial<Track>) => void;
}
```

---

## Zustand Store Shape (Frontend State)

```typescript
interface SongStore {
  song: SongData;
  isDirty: boolean;                    // unsaved changes

  // Mutations (all produce undo entries)
  editChord: (measureIndex: number, action: ChordEditAction) => void;
  editNote: (measureIndex: number, voice: number, action: NoteEditAction) => void;
  setMeasureChanges: (measureIndex: number, changes: MeasureChanges) => void;
  addMeasures: (atIndex: number, count: number) => void;
  deleteMeasures: (start: number, end: number) => void;
  updateMetadata: (changes: Partial<SongMetadata>) => void;
  updateBandConfig: (changes: Partial<BandConfig>) => void;
  loadSong: (song: SongData) => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface UIStore {
  viewport: Viewport;
  selection: Selection | null;
  activeVoice: 0 | 1 | 2 | 3;
  entryMode: "table" | "text";
  showGuides: boolean;
  colorScheme: "diatonic" | "major";
  activePanels: Set<string>;           // "band" | "mixer" | "keys" | "meters" | "lyrics"

  setViewport: (v: Viewport) => void;
  setSelection: (s: Selection | null) => void;
  setActiveVoice: (v: 0 | 1 | 2 | 3) => void;
  toggleEntryMode: () => void;            // toggles entryMode between "table" and "text"
  togglePanel: (panel: string) => void;
}

interface PlaybackStore {
  isPlaying: boolean;
  currentTick: number | null;          // absolute tick position from song start
  isLooping: boolean;
  loopStart: number;                   // tick
  loopEnd: number;                     // tick
  initStatus: PlaybackInitStatus;      // user-gesture audio unlock lifecycle
  initErrorCode: PlaybackInitErrorCode | null;

  play: () => void;
  pause: () => void;
  stop: () => void;
  rewind: () => void;
  seekTo: (tick: number) => void;
  setLoop: (start: number, end: number) => void;
  initializeAudio: () => Promise<void>; // must be invoked from a user gesture; idempotent
  clearInitError: () => void;
}

type PlaybackInitStatus = "locked" | "initializing" | "ready" | "error";

type PlaybackInitErrorCode =
  | "AUDIO_CONTEXT_BLOCKED"            // browser blocked audio context start
  | "SAMPLE_LOAD_FAILED"               // SoundFont/sample load failure
  | "ENGINE_INIT_FAILED";              // any other Tone/audio engine init failure

interface AuthStore {
  user: UserResponse | null;
  accessToken: string | null;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}
```

---

## Music Theory Engine Interface

The theory engine is a pure-function module with no side effects. Lives in `client/src/engine/theory/`.

```typescript
interface TheoryEngine {
  getScaleIntervals(scale: ScaleType): number[];
  // Returns semitone intervals from tonic. E.g., major → [0, 2, 4, 5, 7, 9, 11]

  scaleDegreeToMidi(
    degree: ScaleDegree,
    octave: number,
    chromatic: number,
    key: NoteName,
    scale: ScaleType,
    baseOctave?: number                // default 4
  ): number;
  // Converts scale degree + modifiers to MIDI note number (0–127)

  chordToMidiNotes(
    chord: ChordEvent,
    key: NoteName,
    scale: ScaleType,
    voicingOctave?: number
  ): number[];
  // Returns array of MIDI note numbers for the chord voicing

  getDiatonicQuality(degree: ScaleDegree, scale: ScaleType): ChordQuality;
  // Returns the natural triad quality for a scale degree in a given scale

  getDiatonicSeventh(degree: ScaleDegree, scale: ScaleType): SeventhType;
  // Returns the natural seventh type for a scale degree

  toRomanNumeral(chord: ChordEvent, scale: ScaleType): string;
  // Returns Roman numeral string (e.g., "IV", "viio/V", "bVII")

  toChordName(chord: ChordEvent, key: NoteName, scale: ScaleType): string;
  // Returns absolute chord name (e.g., "Cmaj7", "Dm", "G7/B")

  getChordTones(chord: ChordEvent, scale: ScaleType): ScaleDegree[];
  // Returns scale degrees that are chord tones (for guide tone highlighting)

  getGuideCompatibility(
    degree: ScaleDegree,
    chromatic: number,
    chord: ChordEvent,
    scale: ScaleType
  ): "chord-tone" | "scale-tone" | "chromatic";
  // Classifies a note's consonance against the active chord
}
```

---

## Audio Engine Interface

```typescript
interface AudioEngine {
  initialize(): Promise<void>;
  // Call after user gesture. Loads Tone.js context + piano samples.

  isReady(): boolean;

  loadSong(song: SongData): void;
  // Prepares scheduled parts from song data

  play(): void;
  pause(): void;
  stop(): void;
  seekTo(tick: number): void;

  setTempo(bpm: number): void;
  setLoop(enabled: boolean, startTick?: number, endTick?: number): void;

  setTrackVolume(role: TrackRole, volume: number): void;
  setTrackMute(role: TrackRole, mute: boolean): void;

  onTick(callback: (tick: number) => void): () => void;
  // Subscribe to playback position updates. Returns unsubscribe function.
  // Called ~60fps during playback for cursor animation.

  dispose(): void;
}
```

---

## MIDI Export Interface

```typescript
interface MidiExporter {
  exportSong(song: SongData): Uint8Array;
  // Returns complete MIDI Type 1 file as byte array.
  // Tracks: tempo map, melody (voice 0), harmony (chord voicings), bass, chord names (text events).
  // PPQN: 480.

  exportMelodyOnly(song: SongData, voice?: number): Uint8Array;
  // Single-track MIDI with just the melody line.

  createDragBlob(song: SongData): Blob;
  // Returns a Blob suitable for drag-and-drop transfer to a DAW.
}
```
