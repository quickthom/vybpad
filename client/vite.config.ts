/// <reference types="vitest/config" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Production bundles go to `build/` so `tsc --build` can keep emitting to `dist/` for the workspace.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@vybpad/shared': path.resolve(__dirname, '../shared/types/index.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    /** Playwright specs live under `client/tests/e2e`; watching them triggers full reloads during E2E. */
    watch: { ignored: ['**/tests/e2e/**'] },
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environmentMatchGlobs: [
      ['tests/**/*.test.tsx', 'jsdom'],
      ['tests/unit/store/uiStore.test.ts', 'jsdom'],
      ['tests/unit/store/editorUiSettingsLocalStorage.task-7-6.test.ts', 'jsdom'],
    ],
    globals: false,
    setupFiles: ['./tests/setup-jsdom-pointer.ts'],
    restoreMocks: true,
  },
});
