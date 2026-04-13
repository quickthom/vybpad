import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Transport root for E2E: same node as `TransportControls` — `role="toolbar"` plus
 * `data-audio-ready` mirroring `initStatus` (INTERFACES / TASK-4.1). Use this pair instead of
 * `getByRole(..., { name })` so we do not depend on accessible-name resolution during cold hydration
 * (CI was seeing toolbar `count() === 0` while the element was present).
 */
export function getTransportToolbar(page: Page): Locator {
  // Stable hook for E2E (TASK-4.3); same node still exposes data-audio-ready / aria-busy per INTERFACES.
  return page.getByTestId('vybpad-transport-toolbar');
}

/**
 * Primary Play / "start audio" control. Uses anchored patterns so we do not match substring
 * "play" inside "Stop **play**back" or "Pause **play**back" (Playwright strict mode).
 */
export function getTransportPlayButton(transport: Locator): Locator {
  return transport.getByRole('button', { name: /^(Play|Start audio and play)$/ });
}

/** Visible while `isPlaying` after init — `getTransportPlayButton` does not match this. */
export function getTransportPauseButton(transport: Locator): Locator {
  return transport.getByRole('button', { name: 'Pause playback' });
}

/** Default timeout for sample load + audio init on cold CI runners + throttled sample routes (ms). */
const DEFAULT_PLAYBACK_READY_TIMEOUT_MS = 90_000;

/** First paint / hydration can exceed 15s default on slow GitHub runners. */
const TRANSPORT_TOOLBAR_APPEAR_TIMEOUT_MS = 45_000;

/**
 * INTERFACES.md — `TransportControls` maps `PlaybackStore.initStatus` to the toolbar:
 * - `aria-busy="true"` iff `initStatus === "initializing"`
 * - `data-audio-ready="true"` iff `initStatus === "ready"`
 *
 * Polls until both match so we do not flake when `expect().toHaveAttribute` races a fast
 * initializing → ready transition.
 */
export async function expectTransportPlaybackReady(
  transport: Locator,
  options?: { timeout?: number },
): Promise<void> {
  const timeout = options?.timeout ?? DEFAULT_PLAYBACK_READY_TIMEOUT_MS;
  await expect
    .poll(
      async () => {
        return transport.count();
      },
      {
        timeout: TRANSPORT_TOOLBAR_APPEAR_TIMEOUT_MS,
        message: 'Transport toolbar must be present before checking playback readiness.',
      },
    )
    .toBeGreaterThan(0);
  await expect
    .poll(
      async () => {
        if ((await transport.count()) < 1) return false;
        const ready = await transport.getAttribute('data-audio-ready');
        const busy = await transport.getAttribute('aria-busy');
        // React omits aria-busy when false, so getAttribute is null — only "true" means initializing.
        const notBusy = busy !== 'true';
        return ready === 'true' && notBusy;
      },
      {
        timeout,
        message:
          'Transport must reach ready (data-audio-ready=true, not aria-busy) — PlaybackInitStatus "ready".',
      },
    )
    .toBe(true);
}

/**
 * `EditorLayout` calls `play()` after a successful first `initializeAudio()` from the Play control,
 * so the primary button becomes Pause — do not assert `getTransportPlayButton` after ready.
 */
export async function expectTransportPlaybackRunningAfterInit(transport: Locator): Promise<void> {
  await expect(getTransportPauseButton(transport)).toBeEnabled();
}

/**
 * After navigation/reload, the store resets to locked until the next user gesture.
 * Poll until the toolbar is present and not in the ready state (avoids racing first paint / hydration).
 */
export async function expectTransportPlaybackNotReady(transport: Locator): Promise<void> {
  await expect
    .poll(
      async () => {
        return transport.count();
      },
      {
        timeout: TRANSPORT_TOOLBAR_APPEAR_TIMEOUT_MS,
        message: 'Transport toolbar must be present before checking initial readiness.',
      },
    )
    .toBeGreaterThan(0);
  await expect
    .poll(
      async () => {
        if ((await transport.count()) < 1) return false;
        const ready = await transport.getAttribute('data-audio-ready');
        return ready !== 'true';
      },
      {
        timeout: TRANSPORT_TOOLBAR_APPEAR_TIMEOUT_MS,
        message:
          'Transport must not be audio-ready yet (data-audio-ready≠true) — locked or initializing.',
      },
    )
    .toBe(true);
}
