import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    include: [
      'client/tests/**/*.test.ts',
      'client/tests/**/*.test.tsx',
      'server/tests/**/*.test.ts',
    ],
    environment: 'node',
    environmentMatchGlobs: [
      ['./client/tests/**/*.test.tsx', 'jsdom'],
      ['client/tests/**/*.test.tsx', 'jsdom'],
    ],
    globals: false,
    setupFiles: ['./client/tests/setup-jsdom-pointer.ts'],
  },
  resolve: {
    alias: {
      // Tests import client theory modules that use `@vybpad/shared`; resolve to TS sources
      // so `npm test` works without a prior `shared` package build.
      '@vybpad/shared': path.resolve(__dirname, 'shared/types/index.ts'),
      '@': path.resolve(__dirname, 'client/src'),
    },
  },
});
