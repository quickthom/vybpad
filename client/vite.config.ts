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
    rollupOptions: {
      output: {
        /**
         * Split heavy vendor deps so the initial route shell stays smaller; editor/audio
         * routes load additional async chunks via React.lazy + dynamic imports in the graph.
         * Order: match specific package paths before generic `react` (react-dom/router are separate).
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          if (id.includes('node_modules/tone')) return 'tone';
          if (id.includes('node_modules/smplr')) return 'smplr';
          if (id.includes('node_modules/midi-writer-js')) return 'midi-writer';
          if (id.includes('node_modules/react-dom')) return 'react-dom';
          if (id.includes('node_modules/react-router')) return 'react-router';
          if (id.includes('node_modules/scheduler')) return 'react';
          if (id.includes('node_modules/react/')) return 'react';
          if (id.includes('node_modules/zustand')) return 'zustand';
          if (id.includes('node_modules/immer')) return 'immer';
          return undefined;
        },
      },
    },
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
