import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'package-lock.json',
      'eslint.config.js',
      // Typed by client/tsconfig.node.json; projectService does not attach it to client/tsconfig.json
      'client/vite.config.ts',
      'vitest.config.ts',
      // Unit/integration tests use Vitest mocks and live outside package `src/` tsconfig roots
      'client/tests/**',
      'server/tests/**',
    ],
  },
);
