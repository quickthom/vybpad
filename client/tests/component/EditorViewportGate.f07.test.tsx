/** @vitest-environment jsdom */

/**
 * F-07 P0 — editor route uses the same §4 minimum-width guard as auth (ViewportTooNarrow).
 */

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorViewportGate } from '@/app/EditorViewportGate';

function mockMatchMedia(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('EditorViewportGate — F-07 — §4 narrow viewport', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it('renders ViewportTooNarrow instead of mounting the editor when width < 1024px', () => {
    render(
      <MemoryRouter initialEntries={['/editor/test-id']}>
        <Routes>
          <Route path="/editor/:projectId" element={<EditorViewportGate />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/vYbpad needs a display at least 1024px wide/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('application', { name: /Song editor/i })).not.toBeInTheDocument();
  });
});
