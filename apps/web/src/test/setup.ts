import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { dismissConfirmDelete } from '@brd/ui';

// The delete confirmation is app-wide state: a test that leaves it open must not leak into the next.
afterEach(() => {
  dismissConfirmDelete();
  cleanup();
});

// jsdom lacks these browser APIs, which Radix primitives call when opening popovers and dialogs.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
