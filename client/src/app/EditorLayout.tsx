import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { MeasureBar } from '../components/MeasureBar';
import { EditorCanvas } from '../components/editor/EditorCanvas';
import { EntryModeToggle } from '../components/editor/EntryModeToggle';
import { useAuthStore } from '../store/authStore';
import { useSongStore } from '../store/songStore';
import { useUIStore } from '../store/uiStore';

/**
 * Full grid editor shell (extracted from the former App root) so routing can swap auth vs editor
 * without duplicating canvas wiring — TASK-3.2 can add sibling routes next to `/editor`.
 */
export function EditorLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const song = useSongStore((s) => s.song);
  const editChord = useSongStore((s) => s.editChord);
  const editNote = useSongStore((s) => s.editNote);
  const addMeasures = useSongStore((s) => s.addMeasures);
  const deleteMeasures = useSongStore((s) => s.deleteMeasures);

  const viewport = useUIStore((s) => s.viewport);
  const selection = useUIStore((s) => s.selection);
  const setSelection = useUIStore((s) => s.setSelection);
  const setViewport = useUIStore((s) => s.setViewport);
  const entryMode = useUIStore((s) => s.entryMode);
  const toggleEntryMode = useUIStore((s) => s.toggleEntryMode);
  const activeVoice = useUIStore((s) => s.activeVoice);
  const showGuides = useUIStore((s) => s.showGuides);
  const colorScheme = useUIStore((s) => s.colorScheme);

  const [selectedMeasures, setSelectedMeasures] = useState<[number, number] | null>(null);

  const getSongAfterMutation = useCallback(() => useSongStore.getState().song, []);

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

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-app-bg,#F3F4F6)] text-[var(--color-text-primary,#111827)]">
      <header className="flex min-h-[48px] flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-4 py-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{song.metadata.title || 'vYbpad'}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary,#4B5563)]">
            Grid editor — click to select, drag to move, drag trailing edge to resize (TASK-2.7)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user ? (
            <span className="text-sm text-[var(--color-text-secondary,#4B5563)]">{user.displayName}</span>
          ) : null}
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            Projects
          </button>
          <EntryModeToggle mode={entryMode} onToggle={toggleEntryMode} />
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-strong,#D1D5DB)] bg-[var(--color-surface,#FFFFFF)] px-4 text-sm font-medium text-[var(--color-text-primary,#111827)] outline-none transition hover:bg-[var(--color-surface-muted,#F9FAFB)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2"
          >
            Log out
          </button>
        </div>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-x-auto p-4">
          <EditorCanvas
            song={song}
            viewport={viewport}
            selection={selection}
            playbackTick={null}
            activeVoice={activeVoice}
            entryMode={entryMode}
            showGuides={showGuides}
            colorScheme={colorScheme}
            onChordEdit={editChord}
            onNoteEdit={editNote}
            onSelectionChange={setSelection}
            onViewportChange={setViewport}
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
