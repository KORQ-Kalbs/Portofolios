import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor } from '../../utils/performanceMonitor.js';
import gsap from 'gsap';

describe('PerformanceMonitor', () => {
  let monitor;
  let rafSpy;
  let cancelRafSpy;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    rafSpy = vi.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      return 123; // Mock RAF ID
    });
    cancelRafSpy = vi.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(monitor.fps).toBe(60);
      expect(monitor.frameCount).toBe(0);
      expect(monitor.rafId).toBe(null);
    });
  });

  describe('startMonitoring', () => {
    it('should call requestAnimationFrame', () => {
      monitor.startMonitoring();
      expect(rafSpy).toHaveBeenCalledWith(expect.any(Function));
      expect(monitor.rafId).toBe(123);
    });

    it('should bind measure method correctly', () => {
      monitor.startMonitoring();
      expect(rafSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('measure', () => {
    it('should increment frame count', () => {
      expect(monitor.frameCount).toBe(0);
      monitor.measure();
      expect(monitor.frameCount).toBe(1);
    });

    it('should calculate FPS after 1 second', () => {
      const nowSpy = vi.spyOn(performance, 'now');
      nowSpy.mockReturnValue(1000);
      
      monitor.lastTime = 0;
      monitor.frameCount = 59; // Will be incremented to 60 in measure()
      
      monitor.measure();
      
      expect(monitor.fps).toBe(60);
      expect(monitor.frameCount).toBe(0);
      expect(monitor.lastTime).toBe(1000);
    });

    it('should call optimizeAnimations when FPS drops below 50', () => {
      const optimizeSpy = vi.spyOn(monitor, 'optimizeAnimations');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const nowSpy = vi.spyOn(performance, 'now');
      nowSpy.mockReturnValue(1000);
      
      monitor.lastTime = 0;
      monitor.frameCount = 44; // Will be incremented to 45 in measure()
      
      monitor.measure();
      
      expect(monitor.fps).toBe(45);
      expect(warnSpy).toHaveBeenCalledWith('Low FPS detected:', 45);
      expect(optimizeSpy).toHaveBeenCalled();
      
      warnSpy.mockRestore();
    });

    it('should not call optimizeAnimations when FPS is 50 or above', () => {
      const optimizeSpy = vi.spyOn(monitor, 'optimizeAnimations');
      const nowSpy = vi.spyOn(performance, 'now');
      nowSpy.mockReturnValue(1000);
      
      monitor.lastTime = 0;
      monitor.frameCount = 54; // Will be incremented to 55 in measure()
      
      monitor.measure();
      
      expect(monitor.fps).toBe(55);
      expect(optimizeSpy).not.toHaveBeenCalled();
    });

    it('should continue monitoring by calling requestAnimationFrame', () => {
      monitor.measure();
      expect(rafSpy).toHaveBeenCalled();
    });
  });

  describe('optimizeAnimations', () => {
    it('should increase global timeline timeScale to 1.2', () => {
      const timeScaleSpy = vi.spyOn(gsap.globalTimeline, 'timeScale');
      
      monitor.optimizeAnimations();
      
      expect(timeScaleSpy).toHaveBeenCalledWith(1.2);
    });
  });

  describe('stopMonitoring', () => {
    it('should cancel requestAnimationFrame', () => {
      monitor.rafId = 123;
      monitor.stopMonitoring();
      
      expect(cancelRafSpy).toHaveBeenCalledWith(123);
      expect(monitor.rafId).toBe(null);
    });

    it('should handle null rafId gracefully', () => {
      monitor.rafId = null;
      monitor.stopMonitoring();
      
      expect(cancelRafSpy).not.toHaveBeenCalled();
      expect(monitor.rafId).toBe(null);
    });
  });

  describe('integration', () => {
    it('should track FPS over multiple frames', () => {
      let frameTime = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => frameTime);
      
      monitor.startMonitoring();
      
      // Simulate 60 frames over 1 second
      for (let i = 0; i < 60; i++) {
        frameTime += 16.67; // ~60fps
        monitor.measure();
      }
      
      frameTime = 1000;
      monitor.measure();
      
      expect(monitor.fps).toBeGreaterThanOrEqual(55);
      expect(monitor.fps).toBeLessThanOrEqual(65);
    });
  });
});
