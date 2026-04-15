import type { ReactElement } from 'react';

import { ViewportTooNarrow } from '../components/common/ViewportTooNarrow';
import { useMinViewport1024 } from '../hooks/useMinViewport1024';
import { EditorLayout } from './EditorLayout';

/** UX §4 — block interactive editor below 1024px without mounting full editor shell. */
export function EditorViewportGate(): ReactElement {
  const wideEnough = useMinViewport1024();
  if (!wideEnough) {
    return <ViewportTooNarrow />;
  }
  return <EditorLayout />;
}
