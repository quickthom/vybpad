import type { ReactElement } from 'react';

/**
 * F10-12-15 — Tooltip placeholder (Builder replaces with full hover/focus/Escape behavior).
 * Committed so QA contract tests resolve; behavior is intentionally incomplete until implementation lands.
 */
export type TooltipProps = {
  label: string;
  children: ReactElement;
};

export function Tooltip({ children }: TooltipProps): ReactElement {
  return children;
}
