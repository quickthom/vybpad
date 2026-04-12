import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['client/tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      // Tests import client theory modules that use `@vybpad/shared`; resolve to TS sources
      // so `npm test` works without a prior `shared` package build.
      '@vybpad/shared': path.resolve(__dirname, 'shared/types/index.ts'),
    },
  },
});
