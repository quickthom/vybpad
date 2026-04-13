import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Toolbar that wraps transport controls (UX §5.8).
 */
export function getTransportToolbar(page: Page): Locator {
  return page.getByRole('toolbar', { name: 'Transport' });
}

/**
 * Primary Play / "start audio" control. Uses anchored patterns so we do not match substring
 * "play" inside "Stop **play**back" or "Pause **play**back" (Playwright strict mode).
 */
export function getTransportPlayButton(transport: Locator): Locator {
  return transport.getByRole('button', { name: /^(Play|Start audio and play)$/ });
}

/** Default timeout for sample load + audio init on cold CI runners (ms). */
const DEFAULT_PLAYBACK_READY_TIMEOUT_MS = 60_000;

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
        const ready = await transport.getAttribute('data-audio-ready');
        const busy = await transport.getAttribute('aria-busy');
        return ready === 'true' && busy === 'false';
      },
      {
        timeout,
        message:
          'Transport must reach ready (data-audio-ready=true, aria-busy=false) — PlaybackInitStatus "ready".',
      },
    )
    .toBe(true);
}

/**
 * After navigation/reload, the store resets to locked until the next user gesture.
 * Assert toolbar is not in the ready state before starting the next init cycle.
 */
export async function expectTransportPlaybackNotReady(transport: Locator): Promise<void> {
  await expect(transport).toHaveAttribute('data-audio-ready', 'false');
}
