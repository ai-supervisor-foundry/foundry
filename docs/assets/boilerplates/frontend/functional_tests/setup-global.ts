/**
 * Global setup for all tests: jest-dom matchers and cleanup.
 * MSW is started only in functional_tests (see setup.ts).
 */
if (typeof window.matchMedia === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (_query: string) => ({ matches: true, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true, media: '', onchange: null } as MediaQueryList);
}
if (typeof ResizeObserver === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

expect.extend(matchers);
afterEach(() => cleanup());
