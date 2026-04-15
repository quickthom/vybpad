import type { ReactElement, ReactNode } from 'react';

import { ViewportTooNarrow } from '../components/common/ViewportTooNarrow';
import { useMinViewport1024 } from '../hooks/useMinViewport1024';

/** UX §4 — auth routes SHOULD use the same minimum-width guard as editor and project list. */
export function AuthViewportGate({ children }: { children: ReactNode }): ReactElement {
  const wideEnough = useMinViewport1024();
  if (!wideEnough) {
    return <ViewportTooNarrow />;
  }
  return <>{children}</>;
}
