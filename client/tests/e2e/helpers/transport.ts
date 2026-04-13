import type { Locator, Page } from '@playwright/test';

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
