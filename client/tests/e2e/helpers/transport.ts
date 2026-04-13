import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * E2E transport — INTERFACES `PlaybackStore.initStatus` via toolbar `data-audio-ready` / `aria-busy`.
 * Toolbar and primary play/pause use `data-testid` (TASK-4.3) for stable queries during heavy canvas load.
 */

export function getTransportToolbar(page: Page): Locator {
  return page.getByTestId('vybpad-transport-toolbar');
}

/** @deprecated Prefer {@link getTransportToolbar}; kept for older spec naming */
export const transportToolbar = getTransportToolbar;

export function getTransportPlayButton(transport: Locator): Locator {
  return transport.getByTestId('vybpad-transport-play');
}

/** @deprecated Prefer {@link getTransportPlayButton} */
export const transportPlayButton = getTransportPlayButton;

export function getTransportPauseButton(transport: Locator): Locator {
  return transport.getByTestId('vybpad-transport-pause');
}

/** Default timeout for sample load + audio init on cold GitHub runners + throttled sample routes (ms). */
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

/** Legacy name — same as {@link expectTransportPlaybackReady} (TASK-4.3 hardening). */
export const expectTransportAudioReady = expectTransportPlaybackReady;

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

export const expectTransportAudioNotReady = expectTransportPlaybackNotReady;

/**
 * Click Play, optionally observe sample-loading UI, then wait until the toolbar reports ready.
 * Copy matches TransportControls (piano SoundFont load).
 */
export async function clickTransportPlayAndAwaitReady(
  transport: Locator,
  options?: { timeout?: number; initializingHintTimeoutMs?: number },
): Promise<void> {
  const timeout = options?.timeout ?? DEFAULT_PLAYBACK_READY_TIMEOUT_MS;
  const hintMs = options?.initializingHintTimeoutMs ?? 3_000;

  await getTransportPlayButton(transport).click();

  const initializingUi = transport.getByText('Loading piano samples…');
  await initializingUi.waitFor({ state: 'visible', timeout: hintMs }).catch(() => {
    /* transition can be too fast to observe */
  });

  await expectTransportPlaybackReady(transport, { timeout });
}
