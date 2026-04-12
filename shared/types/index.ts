export type {
  AdditionType,
  ChordEvent,
  ChordQuality,
  NoteEvent,
  NoteName,
  ScaleDegree,
  ScaleType,
  SecondaryChord,
  SecondaryFunction,
  SeventhType,
  SuspensionType,
  TimeSignature,
} from './music.js';

export type {
  BandConfig,
  Measure,
  MeasureChanges,
  SongData,
  SongMetadata,
  Track,
  TrackRole,
} from './song.js';

export type {
  AuthResponse,
  CreateProjectRequest,
  LoginRequest,
  ProjectListResponse,
  ProjectResponse,
  ProjectSummary,
  RefreshResponse,
  RegisterRequest,
  UpdateProjectRequest,
  UserResponse,
} from './api.js';

export type {
  AuthError,
  ConflictError,
  NotFoundError,
  ServerError,
  ValidationError,
} from './errors.js';

export type { ChordEditAction, NoteEditAction, Selection, Viewport } from './editor.js';

export const TICKS_PER_QUARTER = 48;
