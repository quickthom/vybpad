/*
 * QA COVERAGE PLAN — TASK-2.8 (hook module)
 *
 * Keyboard dispatch contracts are exercised in EditorCanvas.keyboard.test.tsx (canvas + window key path).
 * This file asserts the optional hook entry point exists at client/src/hooks/useKeyboard.ts (PAT-014).
 * Dynamic import avoids failing the whole test file at load time before the Builder adds the module.
 */

import { describe, expect, it } from 'vitest';

describe('useKeyboard hook module — TASK-2.8', () => {
  it('exports useKeyboard as a function from client/src/hooks/useKeyboard', async () => {
    const mod = await import('../../../src/hooks/useKeyboard');
    expect(mod).toHaveProperty('useKeyboard');
    expect(typeof mod.useKeyboard).toBe('function');
  });
});
