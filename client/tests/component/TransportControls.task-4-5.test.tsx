/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — TASK-4.5
 *
 * Criterion 1: TransportControlsProps — DOM reflects isPlaying, tempo, currentBeat, init lifecycle props
 *   happy: toolbar shows beat + tempo; play vs pause from isPlaying; ready flag from initStatus
 *   error: —
 *   edges: —
 *
 * Criterion 2: initStatus locked / initializing — transport gated per PAT-026 (non-reentrant while initializing)
 *   happy: while initializing, play is disabled; while not ready, stop/rewind gated
 *   error: —
 *   edges: locked — play remains clickable for user-gesture init path; stop/rewind disabled until ready
 *
 * Criterion 3: initStatus error + initErrorCode — error affordance (alert / copy)
 *   happy: role=alert with non-empty user-facing message
 *   error: —
 *   edges: —
 *
 * Criterion 4: tempo — onTempoChange with numeric BPM in song bounds (20–300 per INTERFACES SongMetadata)
 *   happy: input change yields numeric callback
 *   edges: min/max boundary values
 *
 * Criterion 5: callbacks — play/pause/stop/rewind when controls enabled
 *   happy: each button invokes matching callback
 *   error: disabled controls do not invoke callbacks (play while initializing; stop/rewind/pause while locked)
 *
 * Criterion 6 (ROADMAP 4.5 + UX_GUIDELINES §5.8): play/pause/stop/rewind/tempo affordances + live regions
 *   happy: initializing copy; aria-busy; polite live regions for position + loading; aria-pressed on pause
 *
 * Criterion 7: PlaybackInitErrorCode — user copy via getPlaybackInitErrorMessage on role=alert (UX error pattern)
 */

import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TransportControls } from '@/components/controls/TransportControls';
import { getPlaybackInitErrorMessage } from '@/engine/audio';
import type { PlaybackInitErrorCode } from '@/store/playbackStore';

const BPM_MIN = 20;
const BPM_MAX = 300;

function playbackGroup() {
  return screen.getByRole('group', { name: 'Playback' });
}

function renderTransport(overrides: Partial<ComponentProps<typeof TransportControls>> = {}) {
  const onPlay = vi.fn();
  const onPause = vi.fn();
  const onStop = vi.fn();
  const onRewind = vi.fn();
  const onTempoChange = vi.fn();
  const onUndo = vi.fn();
  const onRedo = vi.fn();

  const props: ComponentProps<typeof TransportControls> = {
    isPlaying: false,
    tempo: 120,
    currentBeat: '1:1',
    initStatus: 'ready',
    initErrorCode: null,
    onPlay,
    onPause,
    onStop,
    onRewind,
    onTempoChange,
    onUndo,
    onRedo,
    ...overrides,
  };

  const view = render(<TransportControls {...props} />);
  return { ...view, onPlay, onPause, onStop, onRewind, onTempoChange, onUndo, onRedo, props };
}

describe('TransportControls — TASK-4.5 — TransportControlsProps surface', () => {
  describe('happy path', () => {
    it('renders currentBeat, tempo value, and toolbar with role toolbar and aria-label Transport', () => {
      renderTransport({ currentBeat: '3:2', tempo: 140 });

      expect(screen.getByRole('toolbar', { name: 'Transport' })).toBeVisible();
      expect(screen.getByRole('spinbutton', { name: /tempo/i })).toHaveValue(140);
      expect(screen.getByText('3:2')).toBeVisible();
    });

    it('shows Pause when isPlaying is true and Play when isPlaying is false (ready)', () => {
      const { rerender } = renderTransport({ isPlaying: false, initStatus: 'ready' });
      expect(within(playbackGroup()).getByRole('button', { name: 'Play' })).toBeInTheDocument();

      rerender(
        <TransportControls
          isPlaying
          tempo={120}
          currentBeat="1:1"
          initStatus="ready"
          initErrorCode={null}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onStop={vi.fn()}
          onRewind={vi.fn()}
          onTempoChange={vi.fn()}
        />,
      );
      expect(screen.getByRole('button', { name: /pause playback/i })).toBeInTheDocument();
    });

    it('sets data-audio-ready true only when initStatus is ready', () => {
      const { rerender } = renderTransport({ initStatus: 'locked' });
      let toolbar = screen.getByRole('toolbar', { name: 'Transport' });
      expect(toolbar).toHaveAttribute('data-audio-ready', 'false');

      rerender(
        <TransportControls
          isPlaying={false}
          tempo={120}
          currentBeat="1:1"
          initStatus="ready"
          initErrorCode={null}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onStop={vi.fn()}
          onRewind={vi.fn()}
          onTempoChange={vi.fn()}
        />,
      );
      toolbar = screen.getByRole('toolbar', { name: 'Transport' });
      expect(toolbar).toHaveAttribute('data-audio-ready', 'true');
    });

    it('exposes tempo as a spinbutton with min/max matching INTERFACES song BPM bounds (20–300)', () => {
      renderTransport({ tempo: 120 });
      const input = screen.getByRole('spinbutton', { name: /tempo/i });
      expect(input).toHaveAttribute('min', String(BPM_MIN));
      expect(input).toHaveAttribute('max', String(BPM_MAX));
    });
  });
});

describe('TransportControls — TASK-4.5 — UX / accessibility (toolbar, live regions, busy)', () => {
  it('sets aria-busy on the toolbar while initStatus is initializing', () => {
    renderTransport({ initStatus: 'initializing' });
    const toolbar = screen.getByRole('toolbar', { name: 'Transport' });
    expect(toolbar).toHaveAttribute('aria-busy', 'true');
  });

  it('does not set aria-busy on the toolbar when initStatus is ready', () => {
    renderTransport({ initStatus: 'ready' });
    const toolbar = screen.getByRole('toolbar', { name: 'Transport' });
    expect(toolbar).not.toHaveAttribute('aria-busy', 'true');
  });

  it('places the visible currentBeat inside an aria-live="polite" region', () => {
    renderTransport({ currentBeat: '7:3' });
    const beat = screen.getByText('7:3');
    expect(beat.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('announces sample loading in a polite live region while initializing', () => {
    renderTransport({ initStatus: 'initializing' });
    const loading = screen.getByText(/loading piano samples/i);
    expect(loading.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('uses Pause with aria-pressed when isPlaying and ready', () => {
    renderTransport({ isPlaying: true, initStatus: 'ready' });
    const pause = screen.getByRole('button', { name: /pause playback/i });
    expect(pause).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('TransportControls — TASK-4.5 — init lifecycle (PAT-026)', () => {
  describe('happy path', () => {
    it('disables the Play control while initStatus is initializing so playback cannot start until past initializing', () => {
      renderTransport({ initStatus: 'initializing' });
      const play = within(playbackGroup()).getByRole('button', { name: 'Start audio and play' });
      expect(play).toBeDisabled();
    });

    it('disables Stop and Rewind while initStatus is locked until the engine reports ready', () => {
      renderTransport({ initStatus: 'locked' });
      expect(screen.getByRole('button', { name: /stop playback/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /rewind/i })).toBeDisabled();
    });

    it('keeps Play enabled when initStatus is locked so a user gesture can start initialization', () => {
      renderTransport({ initStatus: 'locked' });
      const play = within(playbackGroup()).getByRole('button', { name: 'Start audio and play' });
      expect(play).not.toBeDisabled();
    });

    it('disables Stop and Rewind while initStatus is initializing', () => {
      renderTransport({ initStatus: 'initializing' });
      expect(screen.getByRole('button', { name: /stop playback/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /rewind/i })).toBeDisabled();
    });

    it('disables Stop and Rewind while initStatus is error until the engine recovers to ready', () => {
      renderTransport({ initStatus: 'error', initErrorCode: 'ENGINE_INIT_FAILED' });
      expect(screen.getByRole('button', { name: /stop playback/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /rewind/i })).toBeDisabled();
    });
  });

  describe('ROADMAP 4.5 — transport affordances', () => {
    it('shows Starting… on the play control while initStatus is initializing', () => {
      renderTransport({ initStatus: 'initializing' });
      expect(within(playbackGroup()).getByRole('button', { name: 'Start audio and play' })).toHaveTextContent(
        /starting/i,
      );
    });
  });
});

describe('TransportControls — TASK-4.5 — init error affordance (PlaybackInitErrorCode)', () => {
  it.each<[PlaybackInitErrorCode]>([
    ['AUDIO_CONTEXT_BLOCKED'],
    ['SAMPLE_LOAD_FAILED'],
    ['ENGINE_INIT_FAILED'],
  ])('maps initErrorCode %s to role=alert copy from getPlaybackInitErrorMessage', (code) => {
    renderTransport({
      initStatus: 'error',
      initErrorCode: code,
    });
    const toolbar = screen.getByRole('toolbar', { name: 'Transport' });
    const alert = within(toolbar).getByRole('alert');
    expect(alert).toHaveTextContent(getPlaybackInitErrorMessage(code));
  });
});

describe('TransportControls — TASK-4.5 — tempo control', () => {
  describe('happy path', () => {
    it('invokes onTempoChange with numeric BPM when the tempo input changes', () => {
      const { onTempoChange } = renderTransport({ tempo: 120 });
      const input = screen.getByRole('spinbutton', { name: /tempo/i });
      fireEvent.change(input, { target: { value: '88' } });
      expect(onTempoChange).toHaveBeenCalledWith(88);
    });
  });

  describe('edge cases', () => {
    it(`accepts tempo changes at BPM bounds ${BPM_MIN} and ${BPM_MAX} (INTERFACES song tempo range)`, () => {
      const { onTempoChange, rerender } = renderTransport({ tempo: 120 });
      const input = screen.getByRole('spinbutton', { name: /tempo/i });

      fireEvent.change(input, { target: { value: String(BPM_MIN) } });
      expect(onTempoChange).toHaveBeenCalledWith(BPM_MIN);

      onTempoChange.mockClear();
      rerender(
        <TransportControls
          isPlaying={false}
          tempo={BPM_MIN}
          currentBeat="1:1"
          initStatus="ready"
          initErrorCode={null}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onStop={vi.fn()}
          onRewind={vi.fn()}
          onTempoChange={onTempoChange}
        />,
      );
      fireEvent.change(screen.getByRole('spinbutton', { name: /tempo/i }), {
        target: { value: String(BPM_MAX) },
      });
      expect(onTempoChange).toHaveBeenCalledWith(BPM_MAX);
    });
  });
});

describe('TransportControls — TASK-4.5 — transport callbacks', () => {
  describe('happy path', () => {
    it('invokes onPlay once when Play is clicked while ready and not playing', async () => {
      const user = userEvent.setup();
      const { onPlay } = renderTransport({ initStatus: 'ready', isPlaying: false });
      await user.click(within(playbackGroup()).getByRole('button', { name: 'Play' }));
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it('invokes onPause when Pause is clicked while playing and ready', async () => {
      const user = userEvent.setup();
      const { onPause } = renderTransport({ initStatus: 'ready', isPlaying: true });
      await user.click(screen.getByRole('button', { name: /pause playback/i }));
      expect(onPause).toHaveBeenCalledTimes(1);
    });

    it('invokes onStop when Stop is clicked while ready', async () => {
      const user = userEvent.setup();
      const { onStop } = renderTransport({ initStatus: 'ready' });
      await user.click(screen.getByRole('button', { name: /stop playback/i }));
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('invokes onRewind when Rewind is clicked while ready', async () => {
      const user = userEvent.setup();
      const { onRewind } = renderTransport({ initStatus: 'ready' });
      await user.click(screen.getByRole('button', { name: /rewind/i }));
      expect(onRewind).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('does not invoke onPlay when Play is disabled during initializing', async () => {
      const user = userEvent.setup();
      const { onPlay } = renderTransport({ initStatus: 'initializing' });
      const play = within(playbackGroup()).getByRole('button', { name: 'Start audio and play' });
      expect(play).toBeDisabled();
      await user.click(play);
      expect(onPlay).not.toHaveBeenCalled();
    });

    it('does not invoke onStop when Stop is disabled while initStatus is locked', async () => {
      const user = userEvent.setup();
      const { onStop } = renderTransport({ initStatus: 'locked' });
      const stop = screen.getByRole('button', { name: /stop playback/i });
      expect(stop).toBeDisabled();
      await user.click(stop);
      expect(onStop).not.toHaveBeenCalled();
    });

    it('does not invoke onRewind when Rewind is disabled while initStatus is locked', async () => {
      const user = userEvent.setup();
      const { onRewind } = renderTransport({ initStatus: 'locked' });
      const rewind = screen.getByRole('button', { name: /rewind/i });
      expect(rewind).toBeDisabled();
      await user.click(rewind);
      expect(onRewind).not.toHaveBeenCalled();
    });

    it('does not invoke onPause when Pause is disabled while playing but transport is locked', async () => {
      const user = userEvent.setup();
      const { onPause } = renderTransport({ initStatus: 'locked', isPlaying: true });
      const pause = screen.getByRole('button', { name: /pause playback/i });
      expect(pause).toBeDisabled();
      await user.click(pause);
      expect(onPause).not.toHaveBeenCalled();
    });
  });
});

describe('TransportControls — undo/redo controls', () => {
  it('renders Undo and Redo as disabled by default when canUndo / canRedo are omitted', () => {
    renderTransport();
    expect(screen.getByTestId('vybpad-transport-undo')).toBeDisabled();
    expect(screen.getByTestId('vybpad-transport-redo')).toBeDisabled();
  });

  it('invokes onUndo when Undo is clicked and canUndo is true', async () => {
    const user = userEvent.setup();
    const { onUndo } = renderTransport({ canUndo: true });
    await user.click(screen.getByTestId('vybpad-transport-undo'));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onUndo when Undo is disabled', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    renderTransport({ canUndo: false, onUndo });
    await user.click(screen.getByTestId('vybpad-transport-undo'));
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('invokes onRedo when Redo is clicked and canRedo is true', async () => {
    const user = userEvent.setup();
    const { onRedo } = renderTransport({ canRedo: true });
    await user.click(screen.getByTestId('vybpad-transport-redo'));
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onRedo when Redo is disabled', async () => {
    const user = userEvent.setup();
    const onRedo = vi.fn();
    renderTransport({ canRedo: false, onRedo });
    await user.click(screen.getByTestId('vybpad-transport-redo'));
    expect(onRedo).not.toHaveBeenCalled();
  });
});
