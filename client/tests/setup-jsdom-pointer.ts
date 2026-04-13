import '@testing-library/jest-dom/vitest';

/**
 * Vitest jsdom has no native PointerEvent. @testing-library/dom synthesizes pointer events
 * via `new EventConstructor(...)`; when PointerEvent is missing, clientX/clientY stay 0 and
 * canvas hit-testing tests break. Subclass MouseEvent so pointer init matches real browsers.
 */
import '@testing-library/jest-dom/vitest';

export {};

/** jsdom has no Canvas 2D — return a stub so shell tests that mount `EditorCanvas` do not throw. */
if (typeof HTMLCanvasElement !== 'undefined') {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
    if (type === '2d') {
      const canvas = this;
      const noop = (): void => {};
      return new Proxy({} as CanvasRenderingContext2D, {
        get(_target, prop) {
          if (prop === 'canvas') return canvas;
          if (prop === 'fillStyle' || prop === 'strokeStyle') return '';
          if (prop === 'lineWidth') return 1;
          if (prop === 'globalAlpha') return 1;
          return noop;
        },
      });
    }
    return orig.call(this, type as '2d');
  };
}

/** jsdom: `<dialog>` exists but `showModal` / `close` are missing — needed for DeleteProjectDialog tests. */
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

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
