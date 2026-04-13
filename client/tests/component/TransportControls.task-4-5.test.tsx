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
 *   error: disabled controls do not invoke callbacks
 */

import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TransportControls } from '@/components/controls/TransportControls';

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
    ...overrides,
  };

  const view = render(<TransportControls {...props} />);
  return { ...view, onPlay, onPause, onStop, onRewind, onTempoChange, props };
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
  });
});

describe('TransportControls — TASK-4.5 — init error affordance', () => {
  describe('happy path', () => {
    it('shows a non-empty role=alert message when initErrorCode is set (with error-init context)', () => {
      renderTransport({
        initStatus: 'error',
        initErrorCode: 'AUDIO_CONTEXT_BLOCKED',
      });
      const toolbar = screen.getByRole('toolbar', { name: 'Transport' });
      const alert = within(toolbar).getByRole('alert');
      expect(alert.textContent?.trim().length).toBeGreaterThan(0);
    });
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
  });
});
