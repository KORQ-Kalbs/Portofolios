import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { PerformanceMonitor } from '../../utils/performanceMonitor';
import gsap from 'gsap';

describe('Property 6: Universal 60fps Performance', () => {
  let monitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    vi.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      cb();
      return 123;
    });
    vi.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should maintain FPS tracking for any frame sequence', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 10, max: 25, noNaN: true }), { minLength: 10, maxLength: 30 }),
        (frameTimes) => {
          let currentTime = 0;
          vi.spyOn(performance, 'now').mockImplementation(() => currentTime);

          monitor.lastTime = 0;
          monitor.frameCount = 0;

          frameTimes.forEach((frameTime) => {
            currentTime += frameTime;
            monitor.measure();
          });

          expect(monitor.fps).toBeGreaterThan(0);
          expect(monitor.fps).toBeLessThanOrEqual(120);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should detect high performance for fast frame sequences', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 14, max: 18, noNaN: true }), { minLength: 20, maxLength: 50 }),
        (frameTimes) => {
          let currentTime = 0;
          vi.spyOn(performance, 'now').mockImplementation(() => currentTime);

          monitor.lastTime = 0;
          monitor.frameCount = 0;

          const totalFrames = Math.floor(1000 / 16.67);
          for (let i = 0; i < totalFrames; i++) {
            currentTime += 16.67;
            monitor.measure();
          }

          currentTime = 1000;
          monitor.measure();

          expect(monitor.fps).toBeGreaterThanOrEqual(55);
          expect(monitor.fps).toBeLessThanOrEqual(65);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should detect low performance and trigger optimization', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 20, max: 40, noNaN: true }), { minLength: 10, maxLength: 30 }),
        (frameTimes) => {
          const optimizeSpy = vi.spyOn(monitor, 'optimizeAnimations');
          const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
          let currentTime = 0;
          vi.spyOn(performance, 'now').mockImplementation(() => currentTime);

          monitor.lastTime = 0;
          monitor.frameCount = 0;

          const totalFrames = Math.floor(1000 / 33.33);
          for (let i = 0; i < totalFrames; i++) {
            currentTime += 33.33;
            monitor.measure();
          }

          currentTime = 1000;
          monitor.measure();

          expect(monitor.fps).toBeLessThan(50);
          expect(optimizeSpy).toHaveBeenCalled();
          expect(warnSpy).toHaveBeenCalledWith('Low FPS detected:', expect.any(Number));

          warnSpy.mockRestore();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should calculate FPS correctly for any frame count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 120 }),
        (targetFrameCount) => {
          let currentTime = 0;
          vi.spyOn(performance, 'now').mockImplementation(() => currentTime);

          monitor.lastTime = 0;
          monitor.frameCount = 0;

          const frameTime = 1000 / targetFrameCount;
          for (let i = 0; i < targetFrameCount; i++) {
            currentTime += frameTime;
            monitor.measure();
          }

          currentTime = 1000;
          monitor.measure();

          const tolerance = targetFrameCount * 0.1;
          expect(monitor.fps).toBeGreaterThanOrEqual(targetFrameCount - tolerance);
          expect(monitor.fps).toBeLessThanOrEqual(targetFrameCount + tolerance);
        }
      ),
      { numRuns: 15 }
    );
  });

  it('should optimize animations when FPS drops below threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 49 }),
        (lowFps) => {
          const timeScaleSpy = vi.spyOn(gsap.globalTimeline, 'timeScale');
          const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
          let currentTime = 0;
          vi.spyOn(performance, 'now').mockImplementation(() => currentTime);

          monitor.lastTime = 0;
          monitor.frameCount = lowFps - 1;

          currentTime = 1000;
          monitor.measure();

          expect(monitor.fps).toBe(lowFps);
          expect(timeScaleSpy).toHaveBeenCalledWith(1.2);
          expect(warnSpy).toHaveBeenCalled();

          warnSpy.mockRestore();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should not optimize when FPS is at or above threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 120 }),
        (goodFps) => {
          const optimizeSpy = vi.spyOn(monitor, 'optimizeAnimations');
          let currentTime = 0;
          vi.spyOn(performance, 'now').mockImplementation(() => currentTime);

          monitor.lastTime = 0;
          monitor.frameCount = goodFps - 1;

          currentTime = 1000;
          monitor.measure();

          expect(monitor.fps).toBe(goodFps);
          expect(optimizeSpy).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should handle monitoring lifecycle correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (cycles) => {
          for (let i = 0; i < cycles; i++) {
            monitor.startMonitoring();
            expect(monitor.rafId).toBeDefined();
            
            monitor.stopMonitoring();
            expect(monitor.rafId).toBe(null);
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});
