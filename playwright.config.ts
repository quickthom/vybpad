import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the Vite client + Fastify API (ARCHITECTURE.md — Playwright).
 * @see ENVIRONMENTS.md — local E2E prerequisites and env vars.
 * @see PATTERNS.md PAT-029 — both API and client must be reachable before tests (avoids flaky auth/navigation).
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
const apiOrigin = (process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');
const apiHealthUrl = `${apiOrigin}/api/health`;

export default defineConfig({
  testDir: './client/tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        {
          name: 'api',
          command: 'npm run dev --workspace=@vybpad/server',
          url: apiHealthUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
        {
          name: 'client',
          command:
            'npm run dev --workspace=@vybpad/client -- --host 127.0.0.1 --port 5173',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      ],
});
