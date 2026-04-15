/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — F10-12–15
 *
 * Criterion 1 — MIDI export ARIA: parent group `aria-label="MIDI export"`; format control name must not
 *   repeat the region phrase (associate with "Format" / visible label, not `aria-label="MIDI export …"`).
 *   happy: group exists; combobox has accessible name from "Format" label association, no "midi export" in control name
 *   error: N/A
 *   edges: N/A
 *
 * Criterion 2 — ChordPalette inner width: inner scroll/flex column uses `w-full min-w-0` (no fixed `w-72` on that layer).
 *   happy: some layout element under `chord-palette-root` carries both utilities
 *   edges: diatonic mode (primary surface)
 *
 * Criterion 3 — Viewport ≥1024 chrome: header / transport / loop rows use `lg:flex-nowrap` (Tailwind) so primary rows
 *   do not wrap at the `lg` breakpoint. Header row is covered via manual / follow-up E2E if no stable test id yet.
 *   happy: TransportControls + LoopBar roots include `lg:flex-nowrap`
 *   edges: N/A
 */

import { ChordPalette } from '@/components/panels/ChordPalette';
import { LoopBar } from '@/components/controls/LoopBar';
import { MidiExportControls } from '@/components/controls/MidiExportControls';
import { TransportControls } from '@/components/controls/TransportControls';
import { buildDefaultSong } from '@/store/songStore';
import { resetPlaybackStoreForTests, usePlaybackStore } from '@/store/playbackStore';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

afterEach(() => {
  cleanup();
  resetPlaybackStoreForTests();
});

function findElementWithClasses(root: HTMLElement, predicate: (el: HTMLElement) => boolean): HTMLElement | null {
  if (predicate(root)) return root;
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    if (predicate(el)) return el;
  }
  return null;
}

function hasWFullAndMinW0(el: HTMLElement): boolean {
  const c = el.getAttribute('class') ?? '';
  return /\bw-full\b/.test(c) && /\bmin-w-0\b/.test(c);
}

describe('F10-12–15 — MIDI export cluster ARIA (parent group + format naming)', () => {
  describe('happy path', () => {
    it('keeps the trailing cluster in a group labeled "MIDI export" and names the format field without repeating "MIDI export"', () => {
      const song = buildDefaultSong();
      render(
        <TransportControls
          isPlaying={false}
          tempo={120}
          currentBeat="1:1"
          initStatus="ready"
          initErrorCode={null}
          onPlay={() => {}}
          onPause={() => {}}
          onStop={() => {}}
          onRewind={() => {}}
          onTempoChange={() => {}}
          endContent={<MidiExportControls song={song} activeVoice={0} projectName={null} />}
        />,
      );

      const toolbar = screen.getByTestId('vybpad-transport-toolbar');
      const midiGroup = within(toolbar).getByRole('group', { name: 'MIDI export' });
      expect(midiGroup).toBeTruthy();

      expect(within(midiGroup).getByText('Format', { selector: 'label' })).toBeTruthy();

      const combo = within(midiGroup).getByRole('combobox');
      const aria = combo.getAttribute('aria-label');
      expect(aria == null || aria === '').toBe(true);
      expect(combo).toHaveAccessibleName(/^format$/i);

      const ax = combo.getAttribute('aria-label') ?? '';
      expect(ax.toLowerCase()).not.toContain('midi export');
    });
  });
});

describe('F10-12–15 — ChordPalette inner width constraints (w-full min-w-0)', () => {
  describe('happy path', () => {
    it('places w-full min-w-0 on an inner layout layer under the palette root (diatonic)', () => {
      render(
        <ChordPalette
          currentKey="C"
          currentScale="major"
          mode="diatonic"
          onChordSelect={() => {}}
        />,
      );
      const root = screen.getByTestId('chord-palette-root');
      const hit = findElementWithClasses(root, (el) => hasWFullAndMinW0(el));
      expect(hit).not.toBeNull();
      expect(hit!.className).not.toMatch(/\bw-72\b/);
    });
  });
});

describe('F10-12–15 — Transport + loop chrome nowrap at lg (1024px)', () => {
  beforeEach(() => {
    resetPlaybackStoreForTests();
    usePlaybackStore.setState({
      isPlaying: false,
      currentTick: null,
      isLooping: false,
      loopStart: 0,
      loopEnd: 192,
      initStatus: 'ready',
      initErrorCode: null,
    });
  });

  describe('happy path', () => {
    it('applies lg:flex-nowrap to the transport toolbar root', () => {
      render(
        <TransportControls
          isPlaying={false}
          tempo={120}
          currentBeat="1:1"
          initStatus="ready"
          initErrorCode={null}
          onPlay={() => {}}
          onPause={() => {}}
          onStop={() => {}}
          onRewind={() => {}}
          onTempoChange={() => {}}
        />,
      );
      const toolbar = screen.getByTestId('vybpad-transport-toolbar');
      expect(toolbar.className).toMatch(/\blg:flex-nowrap\b/);
    });

    it('applies lg:flex-nowrap to the loop bar root', () => {
      render(<LoopBar />);
      const loop = screen.getByRole('group', { name: /loop/i });
      expect(loop.className).toMatch(/\blg:flex-nowrap\b/);
    });
  });
});
