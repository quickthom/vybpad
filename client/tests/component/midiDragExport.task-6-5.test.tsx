/** @vitest-environment jsdom */
/**
 * TASK-6.5 — MIDI drag export: createDragBlob payload, copy transfer, toast lifecycle.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MidiDragExportControl } from '@/components/controls/MidiDragExportControl';
import { midiExporter } from '@/engine/midi';
import { midiFilenameForSong } from '@/hooks/useMidiDragExport';
import { buildDefaultSong } from '@/store/songStore';
import { useToastStore } from '@/store/toastStore';

afterEach(() => {
  cleanup();
  useToastStore.setState({ message: null, variant: 'error' });
  // Toast store dedupes identical messages within 1500ms — flush so each test can show "Dragging MIDI…".
  useToastStore.getState().showSuccess(`dedupe-flush-${Date.now()}`);
  useToastStore.setState({ message: null, variant: 'error' });
  vi.restoreAllMocks();
});

describe('TASK-6.5 midiFilenameForSong', () => {
  it('sanitizes forbidden filename characters and adds .mid', () => {
    const song = buildDefaultSong();
    song.metadata.title = 'My:Song?';
    expect(midiFilenameForSong(song)).toBe('MySong.mid');
  });
});

describe('TASK-6.5 MidiDragExportControl', () => {
  it('uses createDragBlob(song), copy effect, and adds a File to dataTransfer on drag start', () => {
    const song = buildDefaultSong();
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/midi' });
    const spy = vi.spyOn(midiExporter, 'createDragBlob').mockReturnValue(blob);
    const add = vi.fn();
    render(<MidiDragExportControl song={song} />);
    const btn = screen.getByRole('button', { name: /drag midi file to desktop daw/i });
    const dt = {
      effectAllowed: '',
      items: { add },
    };
    fireEvent.dragStart(btn, { dataTransfer: dt });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(song);
    expect(dt.effectAllowed).toBe('copy');
    expect(add).toHaveBeenCalledTimes(1);
    const f = add.mock.calls[0][0] as File;
    expect(f).toBeInstanceOf(File);
    expect(f.name.endsWith('.mid')).toBe(true);
    expect(useToastStore.getState().message).toBe('Dragging MIDI…');
  });

  it('dismisses the dragging toast on drag end', () => {
    const song = buildDefaultSong();
    vi.spyOn(midiExporter, 'createDragBlob').mockReturnValue(new Blob([], { type: 'audio/midi' }));
    const add = vi.fn();
    render(<MidiDragExportControl song={song} />);
    const btn = screen.getByRole('button', { name: /drag midi file to desktop daw/i });
    const dt = { effectAllowed: '', items: { add } };
    fireEvent.dragStart(btn, { dataTransfer: dt });
    expect(useToastStore.getState().message).toBe('Dragging MIDI…');
    fireEvent.dragEnd(btn);
    expect(useToastStore.getState().message).toBeNull();
  });

  it('is disabled when disabled prop is true', () => {
    const song = buildDefaultSong();
    render(<MidiDragExportControl song={song} disabled />);
    const btn = screen.getByRole('button', { name: /drag midi file to desktop daw/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('draggable', 'false');
  });

  it('shows an error toast when dataTransfer.items.add throws', () => {
    const song = buildDefaultSong();
    vi.spyOn(midiExporter, 'createDragBlob').mockReturnValue(new Blob([], { type: 'audio/midi' }));
    const add = vi.fn(() => {
      throw new Error('unsupported');
    });
    render(<MidiDragExportControl song={song} />);
    const btn = screen.getByRole('button', { name: /drag midi file to desktop daw/i });
    const dt = {
      effectAllowed: '',
      items: { add },
    };
    fireEvent.dragStart(btn, { dataTransfer: dt });
    expect(useToastStore.getState().message).toBe('Could not start MIDI drag.');
    expect(useToastStore.getState().variant).toBe('error');
  });
});
