import type { ReactElement } from 'react';

const uiFont =
  "font-[ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,'Noto_Sans',sans-serif]";

/** UX §4 — full-viewport message when viewport &lt; 1024px (shared with project list, editor, auth). */
export function ViewportTooNarrow(): ReactElement {
  return (
    <div
      className={`flex min-h-screen items-center justify-center bg-[var(--color-app-bg,#F3F4F6)] px-6 py-12 ${uiFont}`}
    >
      <p className="max-w-md text-center text-base text-[var(--color-text-secondary,#4B5563)]">
        vYbpad needs a display at least 1024px wide. Please use a larger window or device.
      </p>
    </div>
  );
}
