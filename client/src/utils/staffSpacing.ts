import type { StaffSpacing } from '../types/editorChrome';

/** Melody grid row height (px) from UI preference; multiples of 4px per UX §3. */
export function melodyRowHeightPx(spacing: StaffSpacing): number {
  switch (spacing) {
    case 'compact':
      return 16;
    case 'default':
      return 20;
    case 'wide':
      return 24;
    default:
      return 20;
  }
}
