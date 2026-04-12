/**
 * Vitest jsdom has no native PointerEvent. @testing-library/dom synthesizes pointer events
 * via `new EventConstructor(...)`; when PointerEvent is missing, clientX/clientY stay 0 and
 * canvas hit-testing tests break. Subclass MouseEvent so pointer init matches real browsers.
 */
export {};

if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = class PointerEvent extends window.MouseEvent {
    declare pointerId: number;
    declare pointerType: string;
    declare isPrimary: boolean;

    constructor(type: string, init?: PointerEventInit) {
      super(type, init);
      this.pointerId = init?.pointerId ?? 0;
      this.pointerType = init?.pointerType ?? '';
      this.isPrimary = init?.isPrimary ?? true;
    }
  } as unknown as typeof PointerEvent;
}
