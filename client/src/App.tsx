import type { Viewport, Selection } from '@vybpad/shared';
import { useCallback, useEffect, useState } from 'react';

import { MeasureBar } from './components/MeasureBar';
import { EditorCanvas } from './components/editor/EditorCanvas';
import { EntryModeToggle } from './components/editor/EntryModeToggle';
import { useSongStore } from './store/songStore';

const DEFAULT_VIEWPORT: Viewport = {
  startMeasure: 0,
  measureCount: 8,
  scrollY: 0,
  zoom: 1,
};

export function App() {
  const song = useSongStore((s) => s.song);
  const editChord = useSongStore((s) => s.editChord);
  const editNote = useSongStore((s) => s.editNote);
  const addMeasures = useSongStore((s) => s.addMeasures);
  const deleteMeasures = useSongStore((s) => s.deleteMeasures);

  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectedMeasures, setSelectedMeasures] = useState<[number, number] | null>(null);
  const [entryMode, setEntryMode] = useState<'table' | 'text'>('table');

  const toggleEntryMode = useCallback(() => {
    setEntryMode((m) => (m === 'table' ? 'text' : 'table'));
  }, []);

  const getSongAfterMutation = useCallback(() => useSongStore.getState().song, []);

  const onViewportChange = useCallback((v: Viewport) => {
    setViewport(v);
  }, []);

  useEffect(() => {
    setSelectedMeasures((prev) => {
      if (!prev) return null;
      const n = song.measures.length;
      if (n === 0) return null;
      const [a, b] = prev;
      const ca = Math.max(0, Math.min(a, n - 1));
      const cb = Math.max(0, Math.min(b, n - 1));
      const lo = Math.min(ca, cb);
      const hi = Math.max(ca, cb);
      if (lo === prev[0] && hi === prev[1]) return prev;
      return [lo, hi] as [number, number];
    });
  }, [song.measures.length]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-app-bg,#F3F4F6)] text-[var(--color-text-primary,#111827)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-4 py-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{song.metadata.title || 'vYbpad'}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary,#4B5563)]">
            Grid editor — click to select, drag to move, drag trailing edge to resize (TASK-2.7)
          </p>
        </div>
        <EntryModeToggle mode={entryMode} onToggle={toggleEntryMode} />
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-x-auto p-4">
          <EditorCanvas
            song={song}
            viewport={viewport}
            selection={selection}
            playbackTick={null}
            activeVoice={0}
            entryMode={entryMode}
            showGuides={false}
            colorScheme="diatonic"
            onChordEdit={editChord}
            onNoteEdit={editNote}
            onSelectionChange={setSelection}
            onViewportChange={onViewportChange}
            getSongAfterMutation={getSongAfterMutation}
            onToggleEntryMode={toggleEntryMode}
          />
        </main>
        <MeasureBar
          measureCount={song.measures.length}
          selectedMeasures={selectedMeasures}
          measuresPerLine={viewport.measureCount}
          onSelectMeasure={(index) => setSelectedMeasures([index, index])}
          onSelectRange={(start, end) => setSelectedMeasures([start, end])}
          onAddMeasures={(count) => addMeasures(song.measures.length, count)}
          onDeleteMeasures={(start, end) => {
            const len = song.measures.length;
            const removing = end - start + 1;
            if (len - removing < 1) return;
            deleteMeasures(start, end);
          }}
        />
      </div>
    </div>
  );
}
