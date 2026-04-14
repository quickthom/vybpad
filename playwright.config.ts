import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';
import { config as loadRootEnv } from 'dotenv';

/**
 * Load repo-root `.env` into `process.env` before Playwright spawns `webServer` children
 * (Fastify + Vite). Matches local `npm run dev` expectations (ENVIRONMENTS.md). Does not
 * override variables already set (CI injects `DATABASE_URL`, JWT secrets, etc.).
 */
const repoRoot = dirname(fileURLToPath(import.meta.url));
loadRootEnv({ path: join(repoRoot, '.env'), quiet: true });

/**
 * Populate `process.env` from repo-root `.env` before webServer children spawn.
 * Playwright does not load `.env` automatically; without this, the API process may miss
 * `DATABASE_URL` / JWT secrets while `/api/health` still returns 200 (ENVIRONMENTS.md).
 * Does not override variables already set in the environment (CI, shell).
 */
function loadRootEnvFile(): void {
  const envPath = resolve(repoRoot, '.env');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (let raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const unexported = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eq = unexported.indexOf('=');
    if (eq <= 0) continue;
    const key = unexported.slice(0, eq).trim();
    let val = unexported.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadRootEnvFile();

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
  /** CPU-starved CI agents need headroom for auth, client navigations, and Web Audio init (TASK-4.3 E2E). */
  expect: { timeout: 45_000 },
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
