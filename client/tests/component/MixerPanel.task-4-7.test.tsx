/** @vitest-environment jsdom */
/*
 * QA COVERAGE PLAN — TASK 4.7
 *
 * Criterion 1 — INTERFACES `MixerPanelProps`: `bandConfig` + `onTrackChange(role, Partial<Track>)`.
 * Criterion 2 — Band config: one control row per track; UI reflects `volume` / `mute`; user edits
 *   invoke callbacks with the correct `TrackRole` and partial track fields.
 * Criterion 3 — UX_GUIDELINES §2 heading hierarchy: panel title "Mixer" uses `h3` (not `h1`/`h2`).
 * Criterion 4 — EditorLayout wiring: after a track change, `AudioEngine.setTrackVolume` /
 *   `setTrackMute` receive values consistent with post-mutation song state when engine `isReady()`.
 */

import type { AudioEngine } from '@/engine/audio';
import * as audio from '@/engine/audio';
import { MixerPanel } from '@/components/panels/MixerPanel';
import { EditorLayout } from '@/app/EditorLayout';
import { buildDefaultSong, useSongStore } from '@/store/songStore';
import { resetPlaybackStoreForTests, usePlaybackStore } from '@/store/playbackStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import type { BandConfig } from '@vybpad/shared';
import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function stubCanvas2d(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextId) => {
    if (contextId !== '2d') {
      return null;
    }
    return {
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      clip: vi.fn(),
      translate: vi.fn(),
      setTransform: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      arcTo: vi.fn(),
      roundRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type MixerPanelProps = ComponentProps<typeof MixerPanel>;

function cloneBand(song = buildDefaultSong()): BandConfig {
  return structuredClone(song.bandConfig);
}

function defaultMixerProps(overrides: Partial<MixerPanelProps> = {}): MixerPanelProps {
  return {
    bandConfig: cloneBand(),
    onTrackChange: vi.fn(),
    ...overrides,
  };
}

function createMockReadyEngine(
  opts: { setTrackVolume?: ReturnType<typeof vi.fn>; setTrackMute?: ReturnType<typeof vi.fn> } = {},
): AudioEngine {
  const setTrackVolume = opts.setTrackVolume ?? vi.fn();
  const setTrackMute = opts.setTrackMute ?? vi.fn();
  return {
    initialize: vi.fn(() => Promise.resolve()),
    isReady: () => true,
    loadSong: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seekTo: vi.fn(),
    setTempo: vi.fn(),
    setLoop: vi.fn(),
    setTrackVolume,
    setTrackMute,
    onTick: vi.fn(() => () => {}),
    dispose: vi.fn(),
  } as unknown as AudioEngine;
}

describe('MixerPanel — INTERFACES MixerPanelProps (TASK 4.7)', () => {
  describe('happy path', () => {
    it('renders when bandConfig and onTrackChange are supplied per INTERFACES.md', () => {
      expect(() => render(<MixerPanel {...defaultMixerProps()} />)).not.toThrow();
      expect(screen.getByRole('heading', { name: 'Mixer' })).toBeTruthy();
    });

    it('renders one volume slider per track in bandConfig.tracks order', () => {
      const bandConfig = cloneBand();
      expect(bandConfig.tracks).toHaveLength(7);
      render(<MixerPanel bandConfig={bandConfig} onTrackChange={vi.fn()} />);
      expect(screen.getAllByRole('slider')).toHaveLength(7);
    });
  });
});

describe('MixerPanel — band config display and onTrackChange mutations (TASK 4.7)', () => {
  it('reflects each track volume as the range value (0–100) and percentage caption', () => {
    const bandConfig = cloneBand();
    const bass = bandConfig.tracks.find((t) => t.role === 'bass')!;
    bass.volume = 0.37;
    render(<MixerPanel bandConfig={bandConfig} onTrackChange={vi.fn()} />);
    const bassSlider = screen.getByRole('slider', { name: /bass volume/i });
    expect((bassSlider as HTMLInputElement).value).toBe('37');
    expect(screen.getByText('37%')).toBeTruthy();
  });

  it('calls onTrackChange with the track role and { volume } when the volume slider changes', () => {
    const onTrackChange = vi.fn();
    render(<MixerPanel {...defaultMixerProps({ onTrackChange })} />);
    const harmonySlider = screen.getByRole('slider', { name: /harmony volume/i });
    fireEvent.change(harmonySlider, { target: { value: '42' } });
    expect(onTrackChange).toHaveBeenCalledTimes(1);
    expect(onTrackChange).toHaveBeenCalledWith(
      'harmony',
      expect.objectContaining({ volume: expect.any(Number) }),
    );
    expect(onTrackChange.mock.calls[0]![1]!.volume).toBeCloseTo(0.42, 10);
    expect(Object.keys(onTrackChange.mock.calls[0]![1]!)).toEqual(['volume']);
  });

  it('calls onTrackChange with { mute } when the mute control is activated', () => {
    const onTrackChange = vi.fn();
    const bandConfig = cloneBand();
    const drums = bandConfig.tracks.find((t) => t.role === 'drums')!;
    drums.mute = false;
    render(<MixerPanel bandConfig={bandConfig} onTrackChange={onTrackChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^mute drums$/i }));
    expect(onTrackChange).toHaveBeenCalledWith('drums', { mute: true });
  });

  it('updates displayed volume when bandConfig prop changes (controlled)', () => {
    const bandA = cloneBand();
    const bassA = bandA.tracks.find((t) => t.role === 'bass')!;
    bassA.volume = 0.1;
    const { rerender } = render(<MixerPanel bandConfig={bandA} onTrackChange={vi.fn()} />);
    expect((screen.getByRole('slider', { name: /bass volume/i }) as HTMLInputElement).value).toBe(
      '10',
    );

    const bandB = cloneBand();
    const bassB = bandB.tracks.find((t) => t.role === 'bass')!;
    bassB.volume = 0.88;
    rerender(<MixerPanel bandConfig={bandB} onTrackChange={vi.fn()} />);
    expect((screen.getByRole('slider', { name: /bass volume/i }) as HTMLInputElement).value).toBe(
      '88',
    );
  });
});

describe('MixerPanel — UX heading hierarchy (TASK 4.7)', () => {
  it('uses an h3 for the Mixer panel title per UX_GUIDELINES §2 (panel titles: h3)', () => {
    render(<MixerPanel {...defaultMixerProps()} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Mixer' })).toBeTruthy();
  });
});

describe('EditorLayout — mixer + AudioEngine mutators (TASK 4.7)', () => {
  beforeEach(() => {
    stubCanvas2d();
    vi.spyOn(audio, 'getPlaybackEngine');
    resetPlaybackStoreForTests();
    usePlaybackStore.setState({
      initStatus: 'ready',
      initErrorCode: null,
    });
    useSongStore.getState().loadSong(buildDefaultSong());
    useUIStore.setState({
      activePanels: new Set<string>(['mixer']),
    });
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'a@b.c',
        displayName: 'Tester',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      accessToken: 'tok',
      isAuthenticated: true,
    });
  });

  it('after a volume change, updates song bandConfig and calls setTrackVolume on the ready engine', () => {
    const setTrackVolume = vi.fn();
    const setTrackMute = vi.fn();
    vi.mocked(audio.getPlaybackEngine).mockReturnValue(
      createMockReadyEngine({ setTrackVolume, setTrackMute }),
    );

    render(
      <BrowserRouter>
        <EditorLayout />
      </BrowserRouter>,
    );

    const panel = screen.getByRole('dialog', { name: 'Mixer' });
    const harmonySlider = within(panel).getByRole('slider', { name: /harmony volume/i });
    fireEvent.change(harmonySlider, { target: { value: '33' } });

    const harmony = useSongStore
      .getState()
      .song.bandConfig.tracks.find((t) => t.role === 'harmony')!;
    expect(harmony.volume).toBeCloseTo(0.33, 5);
    expect(setTrackVolume).toHaveBeenCalledWith('harmony', harmony.volume);
    expect(setTrackMute).toHaveBeenCalledWith('harmony', harmony.mute);
  });

  it('after a mute toggle, calls setTrackMute and setTrackVolume with post-mutation track state', () => {
    const setTrackVolume = vi.fn();
    const setTrackMute = vi.fn();
    vi.mocked(audio.getPlaybackEngine).mockReturnValue(
      createMockReadyEngine({ setTrackVolume, setTrackMute }),
    );

    render(
      <BrowserRouter>
        <EditorLayout />
      </BrowserRouter>,
    );

    const panel = screen.getByRole('dialog', { name: 'Mixer' });
    fireEvent.click(within(panel).getByRole('button', { name: /^mute melody 1$/i }));

    const m1 = useSongStore
      .getState()
      .song.bandConfig.tracks.find((t) => t.role === 'melody1')!;
    expect(m1.mute).toBe(true);
    expect(setTrackMute).toHaveBeenCalledWith('melody1', true);
    expect(setTrackVolume).toHaveBeenCalledWith('melody1', m1.volume);
  });

  it('does not call engine mutators when the engine is not ready', () => {
    const setTrackVolume = vi.fn();
    const setTrackMute = vi.fn();
    const engine = createMockReadyEngine({ setTrackVolume, setTrackMute });
    vi.spyOn(engine, 'isReady').mockReturnValue(false);
    vi.mocked(audio.getPlaybackEngine).mockReturnValue(engine);

    render(
      <BrowserRouter>
        <EditorLayout />
      </BrowserRouter>,
    );

    const panel = screen.getByRole('dialog', { name: 'Mixer' });
    fireEvent.change(within(panel).getByRole('slider', { name: /bass volume/i }), {
      target: { value: '50' },
    });

    expect(useSongStore.getState().song.bandConfig.tracks.find((t) => t.role === 'bass')!.volume).toBe(
      0.5,
    );
    expect(setTrackVolume).not.toHaveBeenCalled();
    expect(setTrackMute).not.toHaveBeenCalled();
  });
});
