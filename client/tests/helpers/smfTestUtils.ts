/**
 * Minimal SMF (Standard MIDI File) helpers for QA assertions — not production code.
 * Parses Type 0/1 files enough to verify header, track count, PPQN, and note deltas.
 */

export interface SmfHeaderInfo {
  format: number;
  numTracks: number;
  ticksPerQuarter: number;
}

export interface TrackNoteSpan {
  channel: number;
  note: number;
  startTick: number;
  endTick: number;
}

/** Read big-endian uint32 at offset. */
function u32(d: Uint8Array, o: number): number {
  return ((d[o]! << 24) | (d[o + 1]! << 16) | (d[o + 2]! << 8) | d[o + 3]!) >>> 0;
}

/** Read big-endian uint16 at offset. */
function u16(d: Uint8Array, o: number): number {
  return (d[o]! << 8) | d[o + 1]!;
}

/** Variable-length quantity (SMF / MIDI). */
export function readVlq(d: Uint8Array, start: number): { value: number; next: number } {
  let value = 0;
  let i = start;
  let byte: number;
  do {
    byte = d[i]!;
    i += 1;
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80 && i < d.length);
  return { value, next: i };
}

/**
 * Returns header fields or throws if bytes are not a valid SMF header chunk.
 */
export function parseSmfHeader(bytes: Uint8Array): SmfHeaderInfo {
  if (bytes.length < 14) {
    throw new Error('SMF: buffer too short for MThd');
  }
  const id = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  if (id !== 'MThd') {
    throw new Error(`SMF: expected MThd, got ${id}`);
  }
  const len = u32(bytes, 4);
  if (len !== 6) {
    throw new Error(`SMF: MThd length must be 6, got ${len}`);
  }
  const format = u16(bytes, 8);
  const numTracks = u16(bytes, 10);
  const division = u16(bytes, 12);
  if (division & 0x8000) {
    throw new Error('SMF: SMPTE division not supported in tests');
  }
  return { format, numTracks, ticksPerQuarter: division };
}

/** Split file into raw track chunk payloads (MTrk bodies only). */
export function listMTrkPayloads(bytes: Uint8Array): Uint8Array[] {
  let offset = 14;
  const out: Uint8Array[] = [];
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(
      bytes[offset]!,
      bytes[offset + 1]!,
      bytes[offset + 2]!,
      bytes[offset + 3]!,
    );
    if (id !== 'MTrk') {
      throw new Error(`SMF: expected MTrk at ${offset}, got ${id}`);
    }
    const len = u32(bytes, offset + 4);
    offset += 8;
    out.push(bytes.subarray(offset, offset + len));
    offset += len;
  }
  return out;
}

interface RawEv {
  absTick: number;
  kind: 'noteOn' | 'noteOff';
  channel: number;
  note: number;
  velocity: number;
}

function parseTrackRaw(trackData: Uint8Array): RawEv[] {
  const raw: RawEv[] = [];
  let pos = 0;
  let absTick = 0;
  let runningStatus = 0;

  while (pos < trackData.length) {
    const d = readVlq(trackData, pos);
    pos = d.next;
    absTick += d.value;

    let peek = trackData[pos];
    if (peek === undefined) break;

    if (peek < 0x80) {
      if (runningStatus === 0) {
        throw new Error('SMF: data byte without running status');
      }
      const status = runningStatus;
      const cmd = status & 0xf0;
      const channel = status & 0x0f;
      if (cmd === 0x90) {
        const note = peek;
        const velocity = trackData[pos + 1];
        if (velocity === undefined) break;
        pos += 2;
        if (velocity > 0) {
          raw.push({ absTick, kind: 'noteOn', channel, note, velocity });
        } else {
          raw.push({ absTick, kind: 'noteOff', channel, note, velocity });
        }
        continue;
      }
      if (cmd === 0x80) {
        const note = peek;
        const velocity = trackData[pos + 1]!;
        pos += 2;
        raw.push({ absTick, kind: 'noteOff', channel, note, velocity });
        continue;
      }
      throw new Error(`SMF: running status 0x${status.toString(16)} not handled`);
    }

    const status = peek;
    pos += 1;

    if (status === 0xff) {
      runningStatus = 0;
      const metaType = trackData[pos]!;
      pos += 1;
      const len = readVlq(trackData, pos);
      pos = len.next + len.value;
      continue;
    }

    if (status === 0xf0) {
      runningStatus = 0;
      while (pos < trackData.length && trackData[pos] !== 0xf7) {
        pos += 1;
      }
      pos += 1;
      continue;
    }

    const cmd = status & 0xf0;
    const channel = status & 0x0f;

    if (cmd >= 0x80 && cmd <= 0xe0) {
      runningStatus = status;
    }

    if (cmd === 0x90) {
      const note = trackData[pos]!;
      const velocity = trackData[pos + 1]!;
      pos += 2;
      if (velocity > 0) {
        raw.push({ absTick, kind: 'noteOn', channel, note, velocity });
      } else {
        raw.push({ absTick, kind: 'noteOff', channel, note, velocity });
      }
      continue;
    }

    if (cmd === 0x80) {
      const note = trackData[pos]!;
      const velocity = trackData[pos + 1]!;
      pos += 2;
      raw.push({ absTick, kind: 'noteOff', channel, note, velocity });
      continue;
    }

    if (cmd === 0xa0 || cmd === 0xb0) {
      pos += 2;
      continue;
    }
    if (cmd === 0xc0 || cmd === 0xd0) {
      pos += 1;
      continue;
    }
    if (cmd === 0xe0) {
      pos += 2;
      continue;
    }

    throw new Error(`SMF: unhandled status 0x${status.toString(16)}`);
  }

  return raw;
}

/**
 * Pair note-on with matching note-off per channel+note; yields held durations in MIDI ticks.
 */
export function noteSpansFromTrack(trackData: Uint8Array): TrackNoteSpan[] {
  const raw = parseTrackRaw(trackData);
  const spans: TrackNoteSpan[] = [];
  const open = new Map<string, { absTick: number; channel: number; note: number }>();

  for (const ev of raw) {
    const key = `${ev.channel}:${ev.note}`;
    if (ev.kind === 'noteOn') {
      open.set(key, { absTick: ev.absTick, channel: ev.channel, note: ev.note });
    } else {
      const o = open.get(key);
      if (o) {
        spans.push({
          channel: o.channel,
          note: o.note,
          startTick: o.absTick,
          endTick: ev.absTick,
        });
        open.delete(key);
      }
    }
  }
  return spans;
}

/** Tracks that contain at least one note span (melody, harmony, etc.). */
export function tracksWithNoteData(midi: Uint8Array): number[] {
  const payloads = listMTrkPayloads(midi);
  const idx: number[] = [];
  payloads.forEach((pl, i) => {
    if (noteSpansFromTrack(pl).length > 0) idx.push(i);
  });
  return idx;
}

/** FF 01 (text) meta event with absolute tick (delta accumulation). */
export interface Ff01TextEvent {
  absTick: number;
  text: string;
}

function decodeMidiTextBytes(raw: Uint8Array): string {
  let s = '';
  for (let i = 0; i < raw.length; i += 1) {
    s += String.fromCharCode(raw[i]!);
  }
  return s;
}

/**
 * Collects SMF meta text events (type 0x01) from one MTrk payload.
 * Mirrors delta-time handling used for note parsing.
 */
export function ff01EventsFromTrack(trackData: Uint8Array): Ff01TextEvent[] {
  const out: Ff01TextEvent[] = [];
  let pos = 0;
  let absTick = 0;
  let runningStatus = 0;

  while (pos < trackData.length) {
    const d = readVlq(trackData, pos);
    pos = d.next;
    absTick += d.value;

    const peek = trackData[pos];
    if (peek === undefined) break;

    if (peek < 0x80) {
      if (runningStatus === 0) {
        throw new Error('SMF: data byte without running status');
      }
      const status = runningStatus;
      const cmd = status & 0xf0;
      if (cmd === 0x90) {
        const note = peek;
        const velocity = trackData[pos + 1];
        if (velocity === undefined) break;
        pos += 2;
        continue;
      }
      if (cmd === 0x80) {
        pos += 2;
        continue;
      }
      throw new Error(`SMF: running status 0x${status.toString(16)} not handled`);
    }

    const status = peek;
    pos += 1;

    if (status === 0xff) {
      runningStatus = 0;
      const metaType = trackData[pos]!;
      pos += 1;
      const len = readVlq(trackData, pos);
      const dataStart = len.next;
      const dataLen = len.value;
      if (metaType === 0x01) {
        const raw = trackData.subarray(dataStart, dataStart + dataLen);
        out.push({ absTick, text: decodeMidiTextBytes(raw) });
      }
      pos = dataStart + dataLen;
      continue;
    }

    if (status === 0xf0) {
      runningStatus = 0;
      while (pos < trackData.length && trackData[pos] !== 0xf7) {
        pos += 1;
      }
      pos += 1;
      continue;
    }

    const cmd = status & 0xf0;

    if (cmd >= 0x80 && cmd <= 0xe0) {
      runningStatus = status;
    }

    if (cmd === 0x90) {
      pos += 2;
      continue;
    }
    if (cmd === 0x80) {
      pos += 2;
      continue;
    }
    if (cmd === 0xa0 || cmd === 0xb0) {
      pos += 2;
      continue;
    }
    if (cmd === 0xc0 || cmd === 0xd0) {
      pos += 1;
      continue;
    }
    if (cmd === 0xe0) {
      pos += 2;
      continue;
    }

    throw new Error(`SMF: unhandled status 0x${status.toString(16)}`);
  }

  return out;
}

/** Every FF 01 text meta in the file, with track index (0 = first MTrk after header). */
export function ff01EventsInFile(midi: Uint8Array): Array<Ff01TextEvent & { trackIndex: number }> {
  const payloads = listMTrkPayloads(midi);
  const out: Array<Ff01TextEvent & { trackIndex: number }> = [];
  payloads.forEach((pl, trackIndex) => {
    for (const ev of ff01EventsFromTrack(pl)) {
      out.push({ ...ev, trackIndex });
    }
  });
  return out;
}
