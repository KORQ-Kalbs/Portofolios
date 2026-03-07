// Test environment setup for Vitest
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock matchMedia for GSAP ScrollTrigger
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock requestAnimationFrame if not available
if (typeof window.requestAnimationFrame === 'undefined') {
  window.requestAnimationFrame = (callback) => {
    return setTimeout(callback, 16);
  };
}

if (typeof window.cancelAnimationFrame === 'undefined') {
  window.cancelAnimationFrame = (id) => {
    clearTimeout(id);
  };
}

// Global test utilities can be added here
