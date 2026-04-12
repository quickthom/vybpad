/**
 * Project persistence and SongData validation (INTERFACES.md §Project Endpoints, PAT-003 UUIDs).
 */
import type { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { NoteName, ScaleType, SongData, TrackRole } from '@vybpad/shared';

const NOTE_NAMES = new Set<NoteName>([
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]);

const SCALE_TYPES = new Set<ScaleType>([
  'major',
  'minor',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'locrian',
  'harmonicMinor',
  'phrygianDominant',
]);

const TRACK_ROLES_ORDER: readonly TrackRole[] = [
  'melody1',
  'melody2',
  'melody3',
  'melody4',
  'harmony',
  'bass',
  'drums',
] as const;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** CreateProjectRequest.name / UpdateProjectRequest.name — 1–100 chars after trim. */
export function normalizeProjectName(raw: string): { ok: true; name: string } | { ok: false; message: string } {
  const name = raw.trim();
  if (name.length < 1) {
    return { ok: false, message: 'Must be 1–100 characters after trimming' };
  }
  if (name.length > 100) {
    return { ok: false, message: 'Must be 1–100 characters after trimming' };
  }
  return { ok: true, name };
}

/**
 * Structural validation for client-supplied SongData (create / full replace on update).
 * Rejects shapes that cannot round-trip as SongData.
 */
export function validateSongData(
  input: unknown,
): { ok: true; data: SongData } | { ok: false; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  if (!isRecord(input)) {
    return { ok: false, fields: { songData: 'Must be an object' } };
  }
  if (input.version !== '1.0') {
    fields['songData.version'] = 'Must be "1.0"';
  }

  const metadata = input.metadata;
  if (!isRecord(metadata)) {
    fields['songData.metadata'] = 'Must be an object';
  } else {
    if (typeof metadata.title !== 'string' || metadata.title.length > 200) {
      fields['songData.metadata.title'] = 'Must be a string, 0–200 characters';
    }
    if (typeof metadata.key !== 'string' || !NOTE_NAMES.has(metadata.key as NoteName)) {
      fields['songData.metadata.key'] = 'Invalid note name';
    }
    if (typeof metadata.scale !== 'string' || !SCALE_TYPES.has(metadata.scale as ScaleType)) {
      fields['songData.metadata.scale'] = 'Invalid scale type';
    }
    if (
      typeof metadata.tempo !== 'number' ||
      !Number.isInteger(metadata.tempo) ||
      metadata.tempo < 20 ||
      metadata.tempo > 300
    ) {
      fields['songData.metadata.tempo'] = 'Must be an integer BPM from 20 to 300';
    }
    const meter = metadata.meter;
    if (!isRecord(meter)) {
      fields['songData.metadata.meter'] = 'Must be an object';
    } else if (
      typeof meter.numerator !== 'number' ||
      typeof meter.denominator !== 'number' ||
      !Number.isInteger(meter.numerator) ||
      !Number.isInteger(meter.denominator) ||
      meter.numerator < 1 ||
      meter.denominator < 1
    ) {
      fields['songData.metadata.meter'] = 'Must have positive integer numerator and denominator';
    }
  }

  if (!Array.isArray(input.measures)) {
    fields['songData.measures'] = 'Must be an array';
  } else if (input.measures.length < 1) {
    fields['songData.measures'] = 'Must contain at least one measure';
  } else {
    input.measures.forEach((m, i) => {
      if (!isRecord(m)) {
        fields[`songData.measures[${i}]`] = 'Each measure must be an object';
        return;
      }
      if (typeof m.id !== 'string') {
        fields[`songData.measures[${i}].id`] = 'Must be a string (UUID)';
      }
      if (!Array.isArray(m.chords)) {
        fields[`songData.measures[${i}].chords`] = 'Must be an array';
      }
      if (!Array.isArray(m.notes) || m.notes.length !== 4) {
        fields[`songData.measures[${i}].notes`] = 'Must be a tuple of four voice arrays';
      } else {
        m.notes.forEach((voice, v) => {
          if (!Array.isArray(voice)) {
            fields[`songData.measures[${i}].notes[${v}]`] = 'Must be an array of note events';
          }
        });
      }
    });
  }

  const band = input.bandConfig;
  if (!isRecord(band) || !Array.isArray(band.tracks)) {
    fields['songData.bandConfig'] = 'Must be an object with a tracks array';
  } else if (band.tracks.length !== TRACK_ROLES_ORDER.length) {
    fields['songData.bandConfig.tracks'] = `Must have exactly ${TRACK_ROLES_ORDER.length} tracks`;
  } else {
    band.tracks.forEach((t, i) => {
      if (!isRecord(t)) {
        fields[`songData.bandConfig.tracks[${i}]`] = 'Each track must be an object';
        return;
      }
      if (t.role !== TRACK_ROLES_ORDER[i]) {
        fields[`songData.bandConfig.tracks[${i}].role`] = `Expected role "${TRACK_ROLES_ORDER[i]}" at index ${i}`;
      }
      if (typeof t.instrument !== 'string') {
        fields[`songData.bandConfig.tracks[${i}].instrument`] = 'Must be a string';
      }
      if (typeof t.volume !== 'number' || t.volume < 0 || t.volume > 1) {
        fields[`songData.bandConfig.tracks[${i}].volume`] = 'Must be a number from 0.0 to 1.0';
      }
      if (typeof t.mute !== 'boolean') {
        fields[`songData.bandConfig.tracks[${i}].mute`] = 'Must be a boolean';
      }
      if (typeof t.octave !== 'number' || !Number.isInteger(t.octave) || t.octave < -2 || t.octave > 2) {
        fields[`songData.bandConfig.tracks[${i}].octave`] = 'Must be an integer from -2 to 2';
      }
    });
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }

  // Narrow — we validated the structural contract; nested chord/note enums are accepted as stored.
  return { ok: true, data: input as unknown as SongData };
}

export function songDataToJson(data: SongData): Prisma.InputJsonValue {
  return data as unknown as Prisma.InputJsonValue;
}

export function rowSongDataToModel(songData: Prisma.JsonValue): SongData {
  return songData as unknown as SongData;
}

export type ProjectRow = {
  id: string;
  name: string;
  song_data: Prisma.JsonValue;
  created_at: Date;
  updated_at: Date;
};

export async function listProjectsForUser(
  prisma: PrismaClient,
  userId: string,
): Promise<Pick<ProjectRow, 'id' | 'name' | 'created_at' | 'updated_at'>[]> {
  return prisma.project.findMany({
    where: { user_id: userId },
    orderBy: { updated_at: 'desc' },
    select: { id: true, name: true, created_at: true, updated_at: true },
  });
}

export async function findProjectForUser(
  prisma: PrismaClient,
  userId: string,
  projectId: string,
): Promise<ProjectRow | null> {
  return prisma.project.findFirst({
    where: { id: projectId, user_id: userId },
  });
}
