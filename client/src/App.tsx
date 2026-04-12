import type { Viewport, Selection } from '@vybpad/shared';
import { useCallback, useState } from 'react';

import { EditorCanvas } from './components/editor/EditorCanvas';
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

  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [selection, setSelection] = useState<Selection | null>(null);

  const onViewportChange = useCallback((v: Viewport) => {
    setViewport(v);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-app-bg,#F3F4F6)] text-[var(--color-text-primary,#111827)]">
      <header className="border-b border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-4 py-3">
        <h1 className="text-xl font-semibold tracking-tight">{song.metadata.title || 'vYbpad'}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary,#4B5563)]">
          Grid editor — click to select, drag to move, drag trailing edge to resize (TASK-2.7)
        </p>
      </header>
      <main className="overflow-x-auto p-4">
        <EditorCanvas
          song={song}
          viewport={viewport}
          selection={selection}
          playbackTick={null}
          activeVoice={0}
          entryMode="table"
          showGuides={false}
          colorScheme="diatonic"
          onChordEdit={editChord}
          onNoteEdit={editNote}
          onSelectionChange={setSelection}
          onViewportChange={onViewportChange}
        />
      </main>
    </div>
  );
}
