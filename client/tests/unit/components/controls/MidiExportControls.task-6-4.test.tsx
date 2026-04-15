/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — TASK-6.4
 *
 * Criterion 1: Export affordance; full song vs melody-only; download uses .mid and correct MidiExporter method
 *   happy: full → exportSong(song); melody → exportMelodyOnly(song, activeVoice) per INTERFACES
 *   edges: activeVoice 0–3 passed through for melody export
 *
 * Criterion 2: Downloaded bytes match exporter output for current song state
 *   happy: Blob passed to URL.createObjectURL matches midiExporter.exportSong / exportMelodyOnly for same song
 *   edges: song prop changes → subsequent download uses updated song
 *
 * Criterion 3: Accessibility / UX (testable toolbar-adjacent controls)
 *   happy: labeled format control, download button discoverable by name (cluster `role="group"` lives on Transport `endContent`)
 */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MidiExportControls } from '@/components/controls/MidiExportControls';
import { midiExporter } from '@/engine/midi';
import { buildDefaultSong } from '@/store/songStore';

/** jsdom Blob may omit or partially implement `arrayBuffer()`; FileReader is reliable. */
async function blobToUint8(b: Blob): Promise<Uint8Array> {
  if (typeof b.arrayBuffer === 'function') {
    try {
      return new Uint8Array(await b.arrayBuffer());
    } catch {
      /* fall through */
    }
  }
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(b);
  });
}

describe('TASK-6.4 MidiExportControls — export affordance and MidiExporter wiring (INTERFACES § MidiExporter)', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  describe('happy path', () => {
    it('renders format control and download affordance', () => {
      const song = buildDefaultSong();
      render(<MidiExportControls song={song} activeVoice={0} projectName={null} />);

      expect(screen.getByLabelText('Format')).toBeTruthy();
      expect(screen.getByTestId('vybpad-midi-export-download')).toBeTruthy();
    });

    it('calls exportSong when full song is selected and the user downloads', async () => {
      const exportSong = vi.spyOn(midiExporter, 'exportSong');
      const exportMelodyOnly = vi.spyOn(midiExporter, 'exportMelodyOnly');
      const song = buildDefaultSong();

      render(<MidiExportControls song={song} activeVoice={2} projectName="P" />);

      await user.selectOptions(screen.getByLabelText('Format'), 'full');
      await user.click(screen.getByTestId('vybpad-midi-export-download'));

      expect(exportSong).toHaveBeenCalledTimes(1);
      expect(exportSong).toHaveBeenCalledWith(song);
      expect(exportMelodyOnly).not.toHaveBeenCalled();
    });

    it('calls exportMelodyOnly with the active voice when melody-only is selected and the user downloads', async () => {
      const exportSong = vi.spyOn(midiExporter, 'exportSong');
      const exportMelodyOnly = vi.spyOn(midiExporter, 'exportMelodyOnly');
      const song = buildDefaultSong();

      render(<MidiExportControls song={song} activeVoice={3} projectName={null} />);

      await user.selectOptions(screen.getByLabelText('Format'), 'melody');
      await user.click(screen.getByTestId('vybpad-midi-export-download'));

      expect(exportMelodyOnly).toHaveBeenCalledTimes(1);
      expect(exportMelodyOnly).toHaveBeenCalledWith(song, 3);
      expect(exportSong).not.toHaveBeenCalled();
    });

    it('passes the same bytes to URL.createObjectURL as midiExporter returns for the selected mode', async () => {
      const song = buildDefaultSong();
      const blobsFromDownload: Blob[] = [];
      vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob) => {
        blobsFromDownload.push(b);
        return `blob:mock-${blobsFromDownload.length}`;
      });
      const exportSong = vi.spyOn(midiExporter, 'exportSong');
      const exportMelodyOnly = vi.spyOn(midiExporter, 'exportMelodyOnly');

      render(<MidiExportControls song={song} activeVoice={0} projectName={null} />);

      await user.selectOptions(screen.getByLabelText('Format'), 'full');
      await user.click(screen.getByTestId('vybpad-midi-export-download'));
      const bytesFull = exportSong.mock.results[0]?.value as Uint8Array;
      const blob1 = blobsFromDownload.at(-1) as Blob;
      expect(await blobToUint8(blob1)).toEqual(bytesFull);

      await user.selectOptions(screen.getByLabelText('Format'), 'melody');
      await user.click(screen.getByTestId('vybpad-midi-export-download'));
      const bytesMelody = exportMelodyOnly.mock.results[0]?.value as Uint8Array;
      const blob2 = blobsFromDownload.at(-1) as Blob;
      expect(await blobToUint8(blob2)).toEqual(bytesMelody);
    });

    it('sets a .mid filename on the download anchor when download runs', async () => {
      const song = buildDefaultSong();
      song.metadata.title = 'My Title';

      const downloads: string[] = [];
      const origAppend = HTMLElement.prototype.appendChild;
      vi.spyOn(document.body, 'appendChild').mockImplementation(function (this: HTMLElement, node: Node) {
        if (node instanceof HTMLAnchorElement) {
          downloads.push(node.download);
        }
        return origAppend.call(this, node);
      });

      render(<MidiExportControls song={song} activeVoice={0} projectName={null} />);
      await user.selectOptions(screen.getByLabelText('Format'), 'full');
      await user.click(screen.getByTestId('vybpad-midi-export-download'));

      expect(downloads.some((d) => d.toLowerCase().endsWith('.mid'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('uses the latest song prop for the next download after rerender', async () => {
      const exportSong = vi.spyOn(midiExporter, 'exportSong');
      const songA = buildDefaultSong();
      const songB = buildDefaultSong();
      songB.metadata.title = 'Other';

      const { rerender } = render(<MidiExportControls song={songA} activeVoice={0} projectName={null} />);
      await user.selectOptions(screen.getByLabelText('Format'), 'full');
      await user.click(screen.getByTestId('vybpad-midi-export-download'));
      expect(exportSong).toHaveBeenLastCalledWith(songA);

      rerender(<MidiExportControls song={songB} activeVoice={0} projectName={null} />);
      await user.click(screen.getByTestId('vybpad-midi-export-download'));
      expect(exportSong).toHaveBeenLastCalledWith(songB);
    });
  });

  describe('accessibility (controls)', () => {
    it('exposes the format field as a combobox with Format labeling', () => {
      const song = buildDefaultSong();
      render(<MidiExportControls song={song} activeVoice={0} projectName={null} />);

      expect(screen.getByRole('combobox', { name: /^format$/i })).toBeTruthy();
    });

    it('exposes the download control with an accessible name referencing MIDI or download', () => {
      const song = buildDefaultSong();
      render(<MidiExportControls song={song} activeVoice={0} projectName={null} />);

      const btn = screen.getByTestId('vybpad-midi-export-download');
      const accessible =
        btn.getAttribute('aria-label') ??
        (btn.textContent && btn.textContent.trim().length > 0 ? btn.textContent : '');
      expect(accessible.toLowerCase()).toMatch(/download|midi|\.mid/);
    });
  });
});
